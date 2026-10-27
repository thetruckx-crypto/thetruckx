/**
 * Standardized API client for NECL Admin Panel
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

import { supabase } from './supabase';

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
    const adminUser = localStorage.getItem('necl_admin_profile_v2');
    if (adminUser) {
      try {
        const parsed = JSON.parse(adminUser);
        if (parsed.email) authHeaders['x-admin-email'] = parsed.email;
      } catch {}
    }
  } catch {}

  const mergedHeaders = {
    ...authHeaders,
    ...(options.headers || {}),
  };

  if (options.signal) {
    return fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      ...options,
      headers: mergedHeaders,
    });
  }

  const controller = new AbortController();
  const timeoutMs = (options as any).timeoutMs || 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
