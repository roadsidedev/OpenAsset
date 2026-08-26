import { apiFetchJson } from '@/lib/apiClient';

const API_BASE = '/api/v1';

export async function fetchFromApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${path}`;
  const data = await apiFetchJson<T>(url, options as any);
  if (data === null) throw new Error(`Request failed: ${path} not available`);
  return data as any;
}

export async function fetchFromApiSoft<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${path}`;
  return apiFetchJson<T>(url, options as any);
}
