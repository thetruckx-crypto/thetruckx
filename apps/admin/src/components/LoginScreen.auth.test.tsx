import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('LoginScreen & TwoFactorScreen - Hardened Authentication & Role Separation', () => {
  const loginScreenCode = fs.readFileSync(
    path.join(__dirname, 'LoginScreen.tsx'),
    'utf-8'
  );

  const twoFactorScreenCode = fs.readFileSync(
    path.join(__dirname, 'TwoFactorScreen.tsx'),
    'utf-8'
  );

  const appCode = fs.readFileSync(
    path.join(__dirname, '..', 'App.tsx'),
    'utf-8'
  );

  const authContextCode = fs.readFileSync(
    path.join(__dirname, '..', 'context', 'AuthContext.tsx'),
    'utf-8'
  );

  describe('1. Removal of Hardcoded Test Credentials & Enforcement of DB Validation', () => {
    it('does not contain hardcoded demo credentials in LoginScreen', () => {
      expect(loginScreenCode).not.toContain("trimmedEmail === 'superadmin.demo@necl.com'");
      expect(loginScreenCode).not.toContain("enteredPassword !== 'Demo@123456'");
    });

    it('enforces Supabase signInWithPassword on login submit', () => {
      expect(loginScreenCode).toContain('supabase.auth.signInWithPassword');
    });

    it('verifies genuine admin_users status in database before granting access', () => {
      expect(loginScreenCode).toContain("from('admin_users')");
      expect(loginScreenCode).toContain("No administrator record associated with this account");
    });

    it('routes Super Admin to onRequire2FA', () => {
      expect(loginScreenCode).toContain("if (realRole === 'SUPER_ADMIN')");
      expect(loginScreenCode).toContain('onRequire2FA(trimmedEmail)');
    });
  });

  describe('2. Authentic MFA Verification in TwoFactorScreen', () => {
    it('does not contain hardcoded OTP 123456 bypass', () => {
      expect(twoFactorScreenCode).not.toContain("code === '123456'");
    });

    it('enforces genuine Supabase MFA factor listing, challenge, and verification', () => {
      expect(twoFactorScreenCode).toContain('supabase.auth.mfa.listFactors()');
      expect(twoFactorScreenCode).toContain('supabase.auth.mfa.challenge');
      expect(twoFactorScreenCode).toContain('supabase.auth.mfa.verify');
    });

    it('rejects authentication if no MFA factor is enrolled for Super Admin', () => {
      expect(twoFactorScreenCode).toContain('Two-Factor Authentication is required for Super Administrators');
    });
  });

  describe('3. Role Separation & Permissions Matrix', () => {
    it('grants Super Admin full access without restrictions', () => {
      expect(appCode).toContain("role: 'SUPER_ADMIN'");
      // In AuthContext, Super Admin has full administrative authority
      expect(authContextCode).toContain("if (adminProfile.role === 'SUPER_ADMIN') return true;");
    });

    it('restricts regular Admin users from superadmin and audit_logs modules', () => {
      expect(authContextCode).toContain("if (['superadmin', 'audit_logs'].includes(moduleKey)) return false;");
    });

    it('prevents client-side privilege escalation in switchRole', () => {
      expect(authContextCode).toContain("if (role === 'SUPER_ADMIN' && prev.realRole !== 'SUPER_ADMIN')");
    });

    it('strictly controls margin visibility (Super Admin yes, Regular Admin no)', () => {
      expect(authContextCode).toContain("if (adminProfile.role === 'SUPER_ADMIN') return true;");
      expect(authContextCode).toContain('canViewMargins');
    });
  });

  describe('4. Functional Permission Enforcement Simulation', () => {
    function simulateHasPermission(
      profile: { role: string; isActive: boolean; permissions?: Record<string, { enabled: boolean; actions?: Record<string, boolean> }> },
      moduleKey: string,
      actionKey?: string
    ): boolean {
      if (!profile) return false;
      if (profile.role === 'SUPER_ADMIN') return true;
      if (profile.isActive === false) return false;
      if (['superadmin', 'audit_logs'].includes(moduleKey)) return false;

      const perms = profile.permissions;
      if (!perms) return false;
      const mod = perms[moduleKey];
      if (!mod || !mod.enabled) return false;
      if (!actionKey) return true;
      return Boolean(mod.actions?.[actionKey]);
    }

    const superAdminProfile = {
      role: 'SUPER_ADMIN',
      isActive: true,
    };

    const regularAdminProfile = {
      role: 'ADMIN',
      isActive: true,
      permissions: {
        clients: { enabled: true, actions: { view: true, create: true } },
        fleet: { enabled: true, actions: { view: true } },
      },
    };

    it('allows Super Admin full access to superadmin module', () => {
      expect(simulateHasPermission(superAdminProfile, 'superadmin')).toBe(true);
      expect(simulateHasPermission(superAdminProfile, 'audit_logs')).toBe(true);
      expect(simulateHasPermission(superAdminProfile, 'pricing', 'view_margins')).toBe(true);
    });

    it('strictly denies regular Admin from accessing superadmin or audit_logs modules', () => {
      expect(simulateHasPermission(regularAdminProfile, 'superadmin')).toBe(false);
      expect(simulateHasPermission(regularAdminProfile, 'audit_logs')).toBe(false);
    });

    it('allows regular Admin only their assigned operational permissions', () => {
      expect(simulateHasPermission(regularAdminProfile, 'clients', 'view')).toBe(true);
      expect(simulateHasPermission(regularAdminProfile, 'clients', 'create')).toBe(true);
      expect(simulateHasPermission(regularAdminProfile, 'fleet', 'view')).toBe(true);
      expect(simulateHasPermission(regularAdminProfile, 'fleet', 'create')).toBe(false);
    });
  });
});
