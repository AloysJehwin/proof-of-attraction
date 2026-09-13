import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SelfieCredential, VerificationTier } from '../verification/tiers';
import { GenderEstimate } from '../verification/genderEstimate';
import {
  ApiMatch, ApiEvent, ApiProfile, ApiAgentAction, ApiAgentUsage,
  getMatches, getEvents, getMe, getAgentActions, revokeAgentAction as apiRevokeAgentAction,
} from '../api';

export type IcebreakerStyle = 'warm' | 'witty' | 'direct';

export type AgentConfig = {
  registered: boolean;
  walletAddress: string | null;
  icebreakerStyle: IcebreakerStyle;
  dealbreakers: string[];
  autoSuggest: boolean;
};

const PREFS_KEY = 'poa_agent_prefs';

type AgentPrefs = Pick<AgentConfig, 'icebreakerStyle' | 'dealbreakers' | 'autoSuggest'>;

const DEFAULT_PREFS: AgentPrefs = { icebreakerStyle: 'warm', dealbreakers: [], autoSuggest: true };

async function loadPrefs(): Promise<AgentPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: AgentPrefs): void {
  SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)).catch(() => undefined);
}

type AppState = {
  tier: VerificationTier;
  selfieCredential: SelfieCredential | null;
  genderEstimate: GenderEstimate | null;
  verifiedOnly: boolean;
  profile: ApiProfile | null;
  matches: ApiMatch[];
  events: ApiEvent[];
  agent: AgentConfig;
  agentLog: ApiAgentAction[];
  agentUsage: ApiAgentUsage | null;
  setTier: (t: VerificationTier) => void;
  setSelfieCredential: (c: SelfieCredential | null) => void;
  setGenderEstimate: (g: GenderEstimate | null) => void;
  setVerifiedOnly: (v: boolean) => void;
  setProfile: (p: ApiProfile | null) => void;
  refreshProfile: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  refreshAgentLog: () => Promise<void>;
  updateAgent: (patch: Partial<AgentConfig>) => void;
  revokeAgentAction: (id: string) => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<VerificationTier>('unverified');
  const [selfieCredential, setSelfieCredential] = useState<SelfieCredential | null>(null);
  const [genderEstimate, setGenderEstimate] = useState<GenderEstimate | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [agent, setAgent] = useState<AgentConfig>({ registered: false, walletAddress: null, ...DEFAULT_PREFS });
  const [agentLog, setAgentLog] = useState<ApiAgentAction[]>([]);
  const [agentUsage, setAgentUsage] = useState<ApiAgentUsage | null>(null);

  useEffect(() => {
    loadPrefs().then((prefs) => setAgent((prev) => ({ ...prev, ...prefs })));
  }, []);

  const refreshProfile = useCallback(async () => {
    const me = await getMe().catch(() => null);
    if (!me) return;
    setProfile(me.profile);
    if (me.user) {
      setTier(me.user.tier);
      setGenderEstimate(me.user.genderEstimate ?? null);
      const wallet = me.user.wallet;
      setAgent((prev) => (wallet ? { ...prev, registered: true, walletAddress: wallet } : prev));
    }
  }, []);

  const refreshMatches = useCallback(async () => {
    const m = await getMatches().catch(() => null);
    if (m) setMatches(m);
  }, []);

  const refreshEvents = useCallback(async () => {
    const e = await getEvents().catch(() => null);
    if (e) setEvents(e);
  }, []);

  const refreshAgentLog = useCallback(async () => {
    const res = await getAgentActions().catch(() => null);
    if (!res) return;
    setAgentLog(res.actions);
    setAgentUsage(res.usage);
  }, []);

  const updateAgent = useCallback((patch: Partial<AgentConfig>) => {
    setAgent((prev) => {
      const next = { ...prev, ...patch };
      savePrefs({ icebreakerStyle: next.icebreakerStyle, dealbreakers: next.dealbreakers, autoSuggest: next.autoSuggest });
      return next;
    });
  }, []);

  const revokeAgentAction = useCallback(async (id: string) => {
    setAgentLog((prev) => prev.map((a) => (a.id === id ? { ...a, revoked: true } : a)));
    await apiRevokeAgentAction(id).catch(() => undefined);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      tier, selfieCredential, genderEstimate, verifiedOnly, profile, matches, events, agent, agentLog, agentUsage,
      setTier, setSelfieCredential, setGenderEstimate, setVerifiedOnly, setProfile,
      refreshProfile, refreshMatches, refreshEvents, refreshAgentLog, updateAgent, revokeAgentAction,
    }),
    [tier, selfieCredential, genderEstimate, verifiedOnly, profile, matches, events, agent, agentLog, agentUsage, refreshProfile, refreshMatches, refreshEvents, refreshAgentLog, updateAgent, revokeAgentAction]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
