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

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarUrl?: string;
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
});

const STORAGE_KEY = "necl_admin_session_v1";

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

  const fetchAdminProfile = useCallback(async (user: User): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, name, email, role, avatar_url")
        .eq("auth_uid", user.id)
        .single();

      if (data && !error) {
        const role: AdminRole = data.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
        persistProfile({
          id: data.id,
          name: data.name ?? user.email ?? "Admin",
          email: data.email ?? user.email ?? "",
          role,
          avatarUrl: data.avatar_url ?? undefined,
        });
        return;
      }
    } catch {}

    const meta = user.user_metadata ?? {};
    const role: AdminRole = meta.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
    persistProfile({
      id: user.id,
      name: meta.name ?? meta.full_name ?? user.email?.split("@")[0] ?? "Admin",
      email: user.email ?? "",
      role,
      avatarUrl: meta.avatar_url ?? undefined,
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
  }, [persistProfile]);

  const switchRole = useCallback((role: AdminRole) => {
    setAdminProfile((prev) => {
      if (!prev) return null;
      const updated = { ...prev, role };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const loginAsAdmin = useCallback((profile: AdminProfile) => {
    persistProfile(profile);
  }, [persistProfile]);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setSupabaseUser(session.user);
          await fetchAdminProfile(session.user);
        } else {
          // If no Supabase session but valid local admin profile exists, keep admin profile
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setAdminProfile(parsed);
            } catch {}
          }
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
