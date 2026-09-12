import * as SecureStore from 'expo-secure-store';

const KEY = 'poa_session_token';
const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';

let cached: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cached) return cached;
  cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY);
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${AGENT_API}${path}`, { ...init, headers });
}
