import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Super Admin Security, Profile Menu & Strict RBAC Enforcement', () => {
  const appPath = path.resolve(__dirname, '../../App.tsx');
  const authContextPath = path.resolve(__dirname, '../../context/AuthContext.tsx');
  const serverPermissionServicePath = path.resolve(__dirname, '../../../../../server/src/services/permissionService.ts');

  const appCode = fs.readFileSync(appPath, 'utf-8');
  const authContextCode = fs.readFileSync(authContextPath, 'utf-8');
  const serverCode = fs.readFileSync(serverPermissionServicePath, 'utf-8');

  describe('1. Top-Right Profile Dropdown Menu Simplification', () => {
    it('shows ONLY the Sign Out option in profile dropdown', () => {
      // Must contain Sign Out button
      expect(appCode).toContain('<button className="dropdown-menu-link logout" onClick={handleLogout}>');
      expect(appCode).toContain('<LogOut size={14} /><span>Sign Out</span>');

      // Must NOT contain switch role or lock/test buttons
      expect(appCode).not.toContain('Switch to {adminProfile?.role ===');
      expect(appCode).not.toContain('Lock / Test Login Screen');
      expect(appCode).not.toContain('switchRole(');
    });
  });

  describe('2. Strict RBAC - Super Admin Unrestricted vs Operational Admin Toggles', () => {
    it('grants Super Admin full authority across all modules and actions', () => {
      expect(authContextCode).toContain("if (adminProfile.role === 'SUPER_ADMIN') return true;");
      expect(serverCode).toContain("if (role === 'SUPER_ADMIN') return true;");
    });

    it('enforces strict deny-by-default for regular admin without permissions', () => {
      // If permissions object is undefined/missing for regular admin, deny access immediately
      expect(authContextCode).toContain('if (!perms) return false;');
      expect(serverCode).toContain('if (!perms) return false;');
    });

    it('requires explicit enabled toggle for regular admin module access', () => {
      expect(authContextCode).toContain('const mod = perms[moduleKey];');
      expect(authContextCode).toContain('if (!mod || !mod.enabled) return false;');
    });

    it('requires explicit action permission toggle for granular operations', () => {
      expect(authContextCode).toContain('return Boolean(mod.actions?.[actionKey]);');
    });
  });

  describe('3. Complete Removal of System Settings for Operational Admin', () => {
    it('forbids settings and system_settings in AuthContext for non-Super Admin', () => {
      expect(authContextCode).toContain("if (['settings', 'system_settings'].includes(moduleKey)) return false;");
    });

    it('hides the Settings section from sidebar navigation for non-Super Admin', () => {
      expect(appCode).toContain("{/* Section: Settings (Super Admin Only) */}");
      expect(appCode).toContain("adminProfile?.role === 'SUPER_ADMIN' && (");
      expect(appCode).not.toContain("hasPermission('settings', 'view')");
    });

    it('protects the /admin/settings route with RequireSuperAdmin guard', () => {
      expect(appCode).toContain('<Route path="settings" element={');
      expect(appCode).toContain('<RequireSuperAdmin>');
      expect(appCode).toContain('<SettingsModule />');
      expect(appCode).toContain('</RequireSuperAdmin>');
    });

    it('enforces settings restrictions in server permission service', () => {
      expect(serverCode).toContain("['superadmin', 'audit_logs', 'settings'].includes(m.key)");
      expect(serverCode).toContain("['superadmin', 'audit_logs', 'settings', 'system_settings'].includes(moduleKey)) return false;");
    });
  });
});
