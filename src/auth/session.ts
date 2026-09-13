import * as SecureStore from 'expo-secure-store';

const KEY = 'poa_session_token';
const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';

let cached: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(fn: (() => void) | null): void {
  onSessionLost = fn;
}

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
  const res = await sendRequest(path, init);
  if (res.status !== 401) return res;

  const refreshed = await tryRefresh();
  if (!refreshed) {
    onSessionLost?.();
    return res;
  }
  return sendRequest(path, init);
}

async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${AGENT_API}${path}`, { ...init, headers });
}

async function tryRefresh(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${AGENT_API}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token?: string };
    if (!data.token) return false;
    await setToken(data.token);
    return true;
  } catch {
    return false;
  }
}
