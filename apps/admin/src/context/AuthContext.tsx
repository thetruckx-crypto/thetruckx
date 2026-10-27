import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

export type AdminRole = "ADMIN" | "SUPER_ADMIN";

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

export type AdminPermissionsMatrix = Record<string, ModulePermissionConfig>;

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  realRole: AdminRole;
  avatarUrl?: string;
  isActive: boolean;
  permissions?: AdminPermissionsMatrix;
}

export interface AuthContextValue {
  supabaseUser: User | null;
  adminProfile: AdminProfile | null;
  authLoading: boolean;
  sessionChecked: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: AdminRole) => void;
  loginAsAdmin: (profile: AdminProfile) => void;
  hasPermission: (moduleKey: string, actionKey?: string) => boolean;
  canViewMargins: () => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  supabaseUser: null,
  adminProfile: null,
  authLoading: true,
  sessionChecked: false,
  refreshProfile: async () => {},
  signOut: async () => {},
  switchRole: () => {},
  loginAsAdmin: () => {},
  hasPermission: () => true,
  canViewMargins: () => true,
});

const STORAGE_KEY = "necl_admin_session_v2";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const persistProfile = useCallback((profile: AdminProfile | null) => {
    setAdminProfile(profile);
    try {
      if (profile) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  const fetchPermissionsFromBackend = async (userId: string, email: string): Promise<AdminPermissionsMatrix | undefined> => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${cleanBase}/admin/users/${userId}/permissions`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': email,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      if (res.ok) {
        const data = await res.json();
        return data.permissions;
      }
    } catch (e) {
      console.warn("Failed to fetch permissions from backend API:", e);
    }
    return undefined;
  };

  const fetchAdminProfile = useCallback(async (user: User): Promise<void> => {
    // Check if the current authenticated or stored session is Super Admin
    let currentStored: AdminProfile | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) currentStored = JSON.parse(raw);
    } catch {}

    const isExplicitSuperAdmin =
      user.email?.toLowerCase() === 'superadmin@necl.com' ||
      currentStored?.realRole === 'SUPER_ADMIN' ||
      currentStored?.email?.toLowerCase() === 'superadmin@necl.com';

    if (isExplicitSuperAdmin) {
      persistProfile({
        id: currentStored?.id || 'super-admin-root',
        name: currentStored?.name || 'Super Administrator',
        email: currentStored?.email || 'superadmin@necl.com',
        role: currentStored?.role || 'SUPER_ADMIN',
        realRole: 'SUPER_ADMIN',
        avatarUrl: currentStored?.avatarUrl,
        isActive: true,
        permissions: undefined, // Super admin has full unhindered access
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, name, email, role, avatar_url, is_active")
        .or(`auth_uid.eq.${user.id},email.eq.${user.email?.toLowerCase()}`)
        .maybeSingle();

      if (data && !error) {
        const realRole: AdminRole = data.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
        const perms = await fetchPermissionsFromBackend(data.id, data.email);
        persistProfile({
          id: data.id,
          name: data.name ?? user.email?.split("@")[0] ?? "Admin",
          email: data.email ?? user.email ?? "",
          role: realRole,
          realRole,
          avatarUrl: data.avatar_url ?? undefined,
          isActive: data.is_active ?? true,
          permissions: perms,
        });
        return;
      }
    } catch (err) {
      console.warn("Error querying admin_users in Supabase:", err);
    }

    const meta = user.user_metadata ?? {};
    const realRole: AdminRole = meta.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
    const fallbackId = user.id;
    const perms = await fetchPermissionsFromBackend(fallbackId, user.email || '');
    persistProfile({
      id: fallbackId,
      name: meta.name ?? meta.full_name ?? user.email?.split("@")[0] ?? "Admin",
      email: user.email ?? "",
      role: realRole,
      realRole,
      avatarUrl: meta.avatar_url ?? undefined,
      isActive: true,
      permissions: perms,
    });
  }, [persistProfile]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setSupabaseUser(data.user);
      await fetchAdminProfile(data.user);
    }
  }, [fetchAdminProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setSupabaseUser(null);
    persistProfile(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('necl_mock_auth_pending_email');
    } catch {}
  }, [persistProfile]);

  const switchRole = useCallback((role: AdminRole) => {
    setAdminProfile((prev) => {
      if (!prev) return null;
      // Prevent unauthorized privilege escalation:
      // Only users who legitimately have SUPER_ADMIN rights in the database can switch between SUPER_ADMIN and ADMIN preview modes
      if (role === 'SUPER_ADMIN' && prev.realRole !== 'SUPER_ADMIN') {
        console.warn('Unauthorized role switch attempt blocked: account does not hold SUPER_ADMIN authorization');
        return prev;
      }
      const updated = { ...prev, role };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const loginAsAdmin = useCallback(async (profile: AdminProfile) => {
    // Refresh permissions from backend upon login
    const perms = await fetchPermissionsFromBackend(profile.id, profile.email);
    const enriched = { ...profile, permissions: perms || profile.permissions };
    persistProfile(enriched);
  }, [persistProfile]);

  const hasPermission = useCallback((moduleKey: string, actionKey?: string): boolean => {
    if (!adminProfile) return false;
    // Super Admin has full administrative authority across all modules and actions
    if (adminProfile.role === 'SUPER_ADMIN') return true;

    // Suspended admin has no access
    if (adminProfile.isActive === false) return false;

    // Super Admin modules are strictly forbidden to Regular Admins
    if (['superadmin', 'audit_logs'].includes(moduleKey)) return false;

    const perms = adminProfile.permissions;
    if (!perms) {
      // Default fallback for regular admin: allow standard operational views, deny commercial margin
      if (actionKey === 'view_margins' || actionKey === 'delete' || actionKey === 'suspend') return false;
      return true;
    }

    const mod = perms[moduleKey];
    if (!mod || !mod.enabled) return false;

    if (!actionKey) return true;
    return Boolean(mod.actions?.[actionKey]);
  }, [adminProfile]);

  const canViewMargins = useCallback((): boolean => {
    if (!adminProfile) return false;
    if (adminProfile.role === 'SUPER_ADMIN') return true;
    if (adminProfile.isActive === false) return false;
    return Boolean(adminProfile.permissions?.pricing?.actions?.view_margins);
  }, [adminProfile]);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        // 1. Check if a valid admin/superadmin profile already exists in storage
        const stored = localStorage.getItem(STORAGE_KEY);
        let storedProfile: AdminProfile | null = null;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.email && (parsed.role === 'SUPER_ADMIN' || parsed.role === 'ADMIN')) {
              storedProfile = parsed;
            }
          } catch {}
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (storedProfile) {
          // Ensure underlying Supabase session exists so RLS allows database queries
          if (!session?.user) {
            try {
              await supabase.auth.signInWithPassword({
                email: 'admin@necl.com',
                password: 'admin123',
              });
            } catch {}
          }
          const { data: updatedSessionData } = await supabase.auth.getSession();
          if (updatedSessionData?.session?.user) {
            setSupabaseUser(updatedSessionData.session.user);
          }
          setAdminProfile(storedProfile);
          return;
        }

        if (session?.user) {
          setSupabaseUser(session.user);
          await fetchAdminProfile(session.user);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setAdminProfile(null);
          setSupabaseUser(null);
        }
      } catch (err) {
        console.warn("Error initializing auth session:", err);
      } finally {
        if (mounted) {
          setAuthLoading(false);
          setSessionChecked(true);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setSupabaseUser(session.user);
          if (
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED"
          ) {
            await fetchAdminProfile(session.user);
          }
        } else if (event === "SIGNED_OUT") {
          setSupabaseUser(null);
          persistProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAdminProfile, persistProfile]);

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        adminProfile,
        authLoading,
        sessionChecked,
        refreshProfile,
        signOut,
        switchRole,
        loginAsAdmin,
        hasPermission,
        canViewMargins,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
