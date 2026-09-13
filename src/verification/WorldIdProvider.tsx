import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { WorldIdModal, WorldIdResult, WorldIdMode } from './WorldIdModal';

type ProofRequest = { action: string; signal: string; mode?: WorldIdMode; sessionId?: string };

type Resolver = (result: { result?: WorldIdResult; error?: string; cancelled?: boolean }) => void;

type WorldIdApi = {
  requestProof: (req: ProofRequest) => Promise<{ result?: WorldIdResult; error?: string; cancelled?: boolean }>;
};

const Ctx = createContext<WorldIdApi | null>(null);

let bridge: WorldIdApi | null = null;

export type ProofResult = { result?: WorldIdResult; error?: string; cancelled?: boolean };

export function requestWorldIdProof(req: ProofRequest): Promise<ProofResult> {
  if (!bridge) return Promise.resolve({ error: 'world id not ready' });
  return bridge.requestProof(req);
}

const VERIFY_URL = process.env.EXPO_PUBLIC_VERIFY_URL ?? '';
const APP_ID = process.env.EXPO_PUBLIC_WORLD_APP_ID ?? 'app_staging_stub';
const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';

export function WorldIdProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ProofRequest | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const settle = useCallback((result: { result?: WorldIdResult; error?: string; cancelled?: boolean }) => {
    setRequest(null);
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.(result);
  }, []);

  const requestProof = useCallback((req: ProofRequest) => {
    return new Promise<{ result?: WorldIdResult; error?: string; cancelled?: boolean }>((resolve) => {
      resolverRef.current = resolve;
      setRequest(req);
    });
  }, []);

  const api = useMemo<WorldIdApi>(() => ({ requestProof }), [requestProof]);

  useEffect(() => {
    bridge = api;
    return () => {
      if (bridge === api) bridge = null;
    };
  }, [api]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {request ? (
        <WorldIdModal
          visible
          verifyUrl={VERIFY_URL}
          appId={APP_ID}
          action={request.action}
          signal={request.signal}
          apiBase={AGENT_API}
          mode={request.mode}
          sessionId={request.sessionId}
          onProof={(result) => settle({ result })}
          onError={(error) => settle({ error })}
          onCancel={() => settle({ cancelled: true })}
        />
      ) : null}
    </Ctx.Provider>
  );
}

export function useWorldId(): WorldIdApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorldId must be used within WorldIdProvider');
  return ctx;
}
