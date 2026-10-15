import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import neclLogo from '../assets/images/necl-logo.png';
import {
  MapPin,
  ShieldCheck,
  Users,
  TrendingUp,
  User,
  Crown,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  X
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: { name: string; role: 'ADMIN' | 'SUPER_ADMIN'; email: string }) => void;
  onRequire2FA: (email: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onRequire2FA }) => {
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCapsLockOn, setIsCapsLockOn] = useState<boolean>(false);

  // Email format verification
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotSuccess, setForgotSuccess] = useState<string>('');
  const [forgotError, setForgotError] = useState<string>('');

  const handleRoleSelect = (role: 'ADMIN' | 'SUPER_ADMIN') => {
    setSelectedRole(role);
    setErrorMessage('');
  };

  const handleKeyDownPassword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setIsCapsLockOn(true);
    } else {
      setIsCapsLockOn(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Password is required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    const enteredPassword = password.trim();

    try {
      // 1. Supabase Authentication
      const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: enteredPassword,
      });

      if (supaErr) {
        throw new Error(supaErr.message || 'Invalid email or password. Please verify your credentials.');
      }

      if (supaData?.user) {
        // Query database record to resolve genuine role and status
        const { data: dbAdmin, error: dbErr } = await supabase
          .from('admin_users')
          .select('id, name, email, role, is_active')
          .or(`auth_uid.eq.${supaData.user.id},email.eq.${trimmedEmail}`)
          .maybeSingle();

        if (dbErr) {
          console.error('Error fetching admin record:', dbErr);
          await supabase.auth.signOut();
          setErrorMessage('Unable to verify administrative authorization. Please contact support.');
          return;
        }

        if (!dbAdmin) {
          await supabase.auth.signOut();
          setErrorMessage('Access denied. No administrator record associated with this account.');
          return;
        }

        if (!dbAdmin.is_active) {
          await supabase.auth.signOut();
          setErrorMessage('Your administrator account has been suspended or deactivated by the Super Admin. Access denied.');
          return;
        }

        const realRole = dbAdmin.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';
        const userName = dbAdmin.name || supaData.user.user_metadata?.name || (realRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin');

        if (realRole === 'SUPER_ADMIN') {
          onRequire2FA(trimmedEmail);
        } else {
          onLoginSuccess({
            name: userName,
            role: 'ADMIN',
            email: trimmedEmail,
          });
        }
        return;
      }

      throw new Error('Invalid email or password. Please verify your credentials.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid registered email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin + '/login',
      });
      if (error) throw error;
      setForgotSuccess('Password reset link sent to your registered email.');
    } catch (err: any) {
      setForgotError(err.message || 'Error sending password reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-screen-layout">
      {/* Edge-to-edge Subtle Dark Overlay */}
      <div className="login-dark-overlay" aria-hidden="true" />

      {/* Edge-to-edge Content Container */}
      <div className="login-content-wrapper">
        {/* ================================================================
            LEFT BRANDING CONTENT (Directly on top of background image)
            ================================================================ */}
        <section className="login-branding-section" aria-label="North Eastern Carriers Overview">
          {/* Top Logo */}
          <div className="hero-brand-header">
            <div className="hero-logo-box">
              <img
                src={neclLogo}
                alt="North Eastern Carriers"
                className="hero-logo-img"
              />
              <div className="hero-logo-tagline">
                LOGISTICS &nbsp;|&nbsp; PEOPLE &nbsp;|&nbsp; PROGRESS
              </div>
            </div>
            <div className="hero-accent-line" />
          </div>

          {/* Main Hero Headline */}
          <div className="hero-headline-group">
            <h1 className="hero-main-title">
              Connecting<br />
              Businesses<br />
              Across <span className="highlight-orange">India</span>
            </h1>
            <p className="hero-subtitle">
              Reliable. Efficient. Trusted Logistics Solutions.
            </p>
          </div>

          {/* 4 Feature Badges in 2x2 Glassmorphic Grid */}
          <div className="hero-features-grid" role="list">
            <div className="hero-feature-card" role="listitem">
              <div className="feature-icon-box">
                <MapPin size={20} />
              </div>
              <div className="feature-text">
                <h4>Pan-India Coverage</h4>
                <p>Serving businesses across every state</p>
              </div>
            </div>

            <div className="hero-feature-card" role="listitem">
              <div className="feature-icon-box">
                <ShieldCheck size={20} />
              </div>
              <div className="feature-text">
                <h4>Secure Transport</h4>
                <p>Your cargo, our priority</p>
              </div>
            </div>

            <div className="hero-feature-card" role="listitem">
              <div className="feature-icon-box">
                <Users size={20} />
              </div>
              <div className="feature-text">
                <h4>Trusted Network</h4>
                <p>Verified partners and fleet</p>
              </div>
            </div>

            <div className="hero-feature-card" role="listitem">
              <div className="feature-icon-box">
                <TrendingUp size={20} />
              </div>
              <div className="feature-text">
                <h4>Real-Time Tracking</h4>
                <p>Stay updated every mile</p>
              </div>
            </div>
          </div>

          {/* Bottom Tagline & Accent Bar */}
          <div className="hero-footer-tagline">
            <div className="orange-accent-dash" />
            <span className="quote-text">“Your Cargo, Our Commitment”</span>
          </div>
        </section>

        {/* ================================================================
            RIGHT FLOATING LOGIN CARD (Floats above the background image)
            ================================================================ */}
        <section className="login-card-floating-wrapper" aria-label="Sign In Form">
          <div className="login-card-container">
            {/* Centered Brand Logo on White Card */}
            <div className="form-brand-center">
              <img
                src={neclLogo}
                alt="North Eastern Carriers"
                className="form-brand-img"
              />
            </div>

            {/* Form Headings */}
            <div className="form-heading-group">
              <h2 className="form-title">Welcome Back</h2>
              <p className="form-desc">Sign in to your Admin Panel to manage operations.</p>
            </div>

            {/* Role Switcher Cards (Admin vs Super Admin) */}
            <div className="role-cards-grid" role="tablist" aria-label="Select Account Role">
              <button
                type="button"
                role="tab"
                aria-selected={selectedRole === 'ADMIN'}
                disabled={isLoading}
                className={`role-card-btn ${selectedRole === 'ADMIN' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('ADMIN')}
              >
                <div className={`role-radio-circle ${selectedRole === 'ADMIN' ? 'checked' : ''}`}>
                  {selectedRole === 'ADMIN' && <div className="role-radio-dot" />}
                </div>
                <User size={18} className="role-card-icon" />
                <div className="role-card-text">
                  <span className="role-card-title">Admin</span>
                  <span className="role-card-sub">Operational Access</span>
                </div>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={selectedRole === 'SUPER_ADMIN'}
                disabled={isLoading}
                className={`role-card-btn ${selectedRole === 'SUPER_ADMIN' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('SUPER_ADMIN')}
              >
                <Crown size={18} className="role-card-icon" />
                <div className="role-card-text">
                  <span className="role-card-title">Super Admin</span>
                  <span className="role-card-sub">Full System Access</span>
                </div>
                <div className={`role-radio-circle ${selectedRole === 'SUPER_ADMIN' ? 'checked' : ''}`} style={{ marginLeft: 'auto' }}>
                  {selectedRole === 'SUPER_ADMIN' && <div className="role-radio-dot" />}
                </div>
              </button>
            </div>

            {/* Interactive Login Form */}
            <form onSubmit={handleLoginSubmit} className="login-form-element" noValidate>
              {errorMessage && (
                <div className="form-alert-error" role="alert">
                  <ShieldAlert size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Email Field */}
              <div className="login-field-box">
                <label htmlFor="login-email" className="login-field-label">Email Address</label>
                <div className="login-input-container">
                  <Mail className="login-input-icon" size={17} />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="username"
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@necl.com"
                  />
                  {isEmailValid && (
                    <div style={{ marginLeft: "auto", paddingRight: "10px", color: "#10B981", display: "flex", alignItems: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="login-field-box">
                <label htmlFor="login-password" className="login-field-label">Password</label>
                <div className="login-input-container">
                  <Lock className="login-input-icon" size={17} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDownPassword}
                    onKeyUp={handleKeyDownPassword}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {isCapsLockOn && (
                  <div style={{ fontSize: "11px", color: "#F59E0B", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                    <ShieldAlert size={13} />
                    <span>Caps Lock is ON</span>
                  </div>
                )}
                <div className="login-forgot-row">
                  <button
                    type="button"
                    className="login-forgot-btn"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotError('');
                      setForgotSuccess('');
                      setIsForgotModalOpen(true);
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Primary Orange CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-login-orange-cta"
              >
                {isLoading ? (
                  <>
                    <span className="spinner-sm" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => setIsForgotModalOpen(false)}>
          <div
            className="forgot-password-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <div className="modal-header-row">
              <h3 id="forgot-modal-title" className="modal-card-title">Reset Password</h3>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsForgotModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="modal-card-desc">
              Enter your registered NECL administrator email address. We will verify your account and dispatch a secure recovery token.
            </p>

            {forgotSuccess ? (
              <div className="forgot-success-state">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="success-msg">{forgotSuccess}</p>
                <button
                  type="button"
                  className="btn-login-orange-cta"
                  onClick={() => setIsForgotModalOpen(false)}
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="forgot-form-element">
                {forgotError && (
                  <div className="form-alert-error" role="alert">
                    <ShieldAlert size={16} />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="login-field-box">
                  <label htmlFor="forgot-email-input" className="login-field-label">Administrator Email</label>
                  <div className="login-input-container">
                    <Mail className="login-input-icon" size={17} />
                    <input
                      id="forgot-email-input"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@necl.com"
                    />
                  </div>
                </div>

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-secondary-cancel"
                    onClick={() => setIsForgotModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-login-orange-cta"
                  >
                    {forgotLoading ? 'Dispatching Link...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
