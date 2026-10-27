import fs from 'fs';
import path from 'path';
import { supabase } from '../supabase';

export interface ActionPermissions {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  approve?: boolean;
  reject?: boolean;
  assign?: boolean;
  suspend?: boolean;
  upload?: boolean;
  verify?: boolean;
  close?: boolean;
  export?: boolean;
  delete?: boolean;
  view_margins?: boolean;
  [key: string]: boolean | undefined;
}

export interface ModulePermissionConfig {
  enabled: boolean;
  actions: ActionPermissions;
  scope?: 'ALL' | 'ASSIGNED';
}

export type PermissionsMatrix = Record<string, ModulePermissionConfig>;

export interface AdminUserRecord {
  id: string;
  auth_uid?: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  permissions?: PermissionsMatrix;
}

export const SYSTEM_MODULES = [
  { key: 'dashboard', name: 'Dashboard & Analytics', allowedActions: ['view', 'export'] },
  { key: 'clients', name: 'Client Management & Approvals', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'suspend', 'export', 'delete'] },
  { key: 'vendors', name: 'Vendor Management & Approvals', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'suspend', 'export', 'delete'] },
  { key: 'drivers', name: 'Driver Verification & Fleet', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'suspend', 'verify', 'export', 'delete'] },
  { key: 'fleet', name: 'Vehicle Directory & Tie-ups', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'suspend', 'verify', 'export', 'delete'] },
  { key: 'requirements', name: 'Transport Requirements', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'assign', 'export', 'delete'] },
  { key: 'quotations', name: 'Sourcing & Vendor RFQs', allowedActions: ['view', 'create', 'edit', 'assign', 'export', 'delete'] },
  { key: 'vendor_quotes', name: 'Vendor Quotation Comparison', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'export', 'view_margins'] },
  { key: 'pricing', name: 'Client Quotes & Pricing', allowedActions: ['view', 'create', 'edit', 'approve', 'reject', 'export', 'view_margins'] },
  { key: 'bookings', name: 'Bookings & Multi-Trip Operations', allowedActions: ['view', 'create', 'edit', 'assign', 'close', 'export', 'delete'] },
  { key: 'pretrip', name: 'Pre-Trip Checks & Gate Passes', allowedActions: ['view', 'edit', 'verify', 'upload', 'export'] },
  { key: 'tracking', name: 'Trip Tracking & Milestones', allowedActions: ['view', 'create', 'edit', 'export'] },
  { key: 'weighbridge', name: 'Weighbridge & Weight Slips', allowedActions: ['view', 'create', 'edit', 'verify', 'upload', 'export'] },
  { key: 'documents', name: 'Document Clearance & Compliance', allowedActions: ['view', 'verify', 'upload', 'reject', 'export', 'delete'] },
  { key: 'pod', name: 'POD Verification & Closure', allowedActions: ['view', 'approve', 'reject', 'close', 'export'] },
  { key: 'payments', name: 'Payments & Financial Ledger', allowedActions: ['view', 'create', 'edit', 'export', 'view_margins'] },
  { key: 'exceptions', name: 'Disruption & Exception Cases', allowedActions: ['view', 'create', 'edit', 'close', 'export'] },
  { key: 'communications', name: 'Communications & Announcements', allowedActions: ['view', 'create', 'export'] },
  { key: 'reports', name: 'Operational & Financial Reports', allowedActions: ['view', 'export', 'view_margins'] },
  { key: 'settings', name: 'Settings & System Parameters', allowedActions: ['view', 'edit'] },
  { key: 'audit_logs', name: 'Security Audit Logs', allowedActions: ['view', 'export'] },
  { key: 'superadmin', name: 'Admin Staff & Permissions', allowedActions: ['view', 'create', 'edit', 'delete'] },
];

export function getFullSuperAdminPermissions(): PermissionsMatrix {
  const matrix: PermissionsMatrix = {};
  for (const m of SYSTEM_MODULES) {
    const actions: ActionPermissions = {};
    for (const a of m.allowedActions) {
      actions[a] = true;
    }
    matrix[m.key] = {
      enabled: true,
      actions,
      scope: 'ALL',
    };
  }
  return matrix;
}

export function getDefaultRegularAdminPermissions(): PermissionsMatrix {
  const matrix: PermissionsMatrix = {};
  for (const m of SYSTEM_MODULES) {
    const isSuperAdminOnly = ['superadmin', 'audit_logs', 'settings'].includes(m.key);
    const isFinance = ['payments'].includes(m.key);
    const isCommercial = ['vendor_quotes', 'pricing', 'reports'].includes(m.key);

    const actions: ActionPermissions = {};
    for (const a of m.allowedActions) {
      if (a === 'view_margins' || a === 'delete' || a === 'suspend') {
        actions[a] = false;
      } else if (isSuperAdminOnly || isFinance) {
        actions[a] = false;
      } else {
        actions[a] = true;
      }
    }

    matrix[m.key] = {
      enabled: !isSuperAdminOnly && !isFinance,
      actions,
      scope: 'ALL',
    };
  }
  return matrix;
}

const PERMISSIONS_FILE = path.join(__dirname, '..', '..', 'data', 'admin_permissions.json');

function readPermissionsFile(): Record<string, PermissionsMatrix> {
  try {
    if (!fs.existsSync(PERMISSIONS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(PERMISSIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writePermissionsFile(data: Record<string, PermissionsMatrix>): void {
  try {
    const dir = path.dirname(PERMISSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[PERMISSION SERVICE] Failed to write permissions file:', err);
  }
}

export const permissionService = {
  getPermissionsForUser(userId: string, role: 'ADMIN' | 'SUPER_ADMIN'): PermissionsMatrix {
    if (role === 'SUPER_ADMIN') {
      return getFullSuperAdminPermissions();
    }
    const store = readPermissionsFile();
    if (store[userId]) {
      return store[userId];
    }
    const defaultPerms = getDefaultRegularAdminPermissions();
    store[userId] = defaultPerms;
    writePermissionsFile(store);
    return defaultPerms;
  },

  async setPermissionsForUser(
    targetUserId: string,
    newPermissions: PermissionsMatrix,
    actorId: string = 'superadmin',
    actorEmail: string = 'superadmin@necl.com'
  ): Promise<PermissionsMatrix> {
    const store = readPermissionsFile();
    const before = store[targetUserId] || getDefaultRegularAdminPermissions();

    // Sanitize matrix according to SYSTEM_MODULES rules:
    // If a module is disabled, all child actions must be disabled
    const sanitized: PermissionsMatrix = {};
    for (const m of SYSTEM_MODULES) {
      const incoming = newPermissions[m.key];
      if (!incoming || !incoming.enabled) {
        const disabledActions: ActionPermissions = {};
        for (const a of m.allowedActions) {
          disabledActions[a] = false;
        }
        sanitized[m.key] = {
          enabled: false,
          actions: disabledActions,
          scope: incoming?.scope || 'ALL',
        };
      } else {
        const actions: ActionPermissions = {};
        for (const a of m.allowedActions) {
          actions[a] = Boolean(incoming.actions?.[a]);
        }
        // If view action is disabled, all mutation actions must also be disabled
        if (!actions.view) {
          for (const a of m.allowedActions) {
            actions[a] = false;
          }
        }
        sanitized[m.key] = {
          enabled: Boolean(actions.view),
          actions,
          scope: incoming.scope || 'ALL',
        };
      }
    }

    store[targetUserId] = sanitized;
    writePermissionsFile(store);

    // Persist immutable audit log to Supabase audit_logs
    try {
      await supabase.from('audit_logs').insert([
        {
          user_id: actorId,
          user_role: 'SUPER_ADMIN',
          action: 'UPDATE_ADMIN_PERMISSIONS',
          entity_type: 'ADMIN_USER',
          entity_id: targetUserId,
          payload_before: before,
          payload_after: sanitized,
          ip_address: '127.0.0.1',
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (auditErr: any) {
      console.warn('[PERMISSION SERVICE] Audit log insert notice:', auditErr?.message);
    }

    return sanitized;
  },

  hasPermission(
    perms: PermissionsMatrix,
    role: 'ADMIN' | 'SUPER_ADMIN',
    moduleKey: string,
    actionKey?: string
  ): boolean {
    if (role === 'SUPER_ADMIN') return true;
    const mod = perms[moduleKey];
    if (!mod || !mod.enabled) return false;
    if (!actionKey) return true;
    return Boolean(mod.actions?.[actionKey]);
  },
};
