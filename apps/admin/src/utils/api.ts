/**
 * Standardized API client for NECL Admin Panel
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return fetch(`${API_BASE_URL}${cleanEndpoint}`, options);
}
