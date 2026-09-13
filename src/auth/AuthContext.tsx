import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { getToken, setToken as persistToken, clearToken, setSessionLostHandler } from './session';
import { getMe, Me } from '../api';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

type AuthState = {
  status: AuthStatus;
  me: Me | null;
  signIn: (token: string) => Promise<Me | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<Me | null>(null);

  const resolve = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setMe(null);
      setStatus('signed-out');
      return;
    }
    const resolved = await getMe().catch(() => null);
    if (resolved) {
      setMe(resolved);
      setStatus('signed-in');
    } else {
      await clearToken();
      setMe(null);
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  const signIn = useCallback(async (token: string) => {
    await persistToken(token);
    const resolved = await getMe().catch(() => null);
    setMe(resolved);
    setStatus('signed-in');
    return resolved;
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setMe(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      clearToken();
      setMe(null);
      setStatus('signed-out');
    });
    return () => setSessionLostHandler(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, me, signIn, signOut, refresh: resolve }),
    [status, me, signIn, signOut, resolve],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
