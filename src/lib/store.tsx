import React, { createContext, useContext, useMemo, useState } from 'react';
import { CURRENT_USER, DISCOVERY_DECK, Profile } from './data';
import { SelfieCredential, VerificationTier } from '../verification/tiers';

export type AgentConfig = {
  registered: boolean;
  walletAddress: string | null;
  icebreakerStyle: 'warm' | 'witty' | 'direct';
  dealbreakers: string[];
  autoSuggest: boolean;
};

export type AgentAction = {
  id: string;
  kind: 'context' | 'icebreaker' | 'send';
  matchName: string;
  detail: string;
  verified: boolean;
  at: number;
};

export type Match = {
  profile: Profile;
  firstMessageUnlocked: boolean;
  messages: { from: 'me' | 'them'; text: string; viaAgent?: boolean; at: number }[];
};

type AppState = {
  tier: VerificationTier;
  selfieCredential: SelfieCredential | null;
  verifiedOnly: boolean;
  matches: Match[];
  agent: AgentConfig;
  agentLog: AgentAction[];
  rsvpEvents: string[];
  setTier: (t: VerificationTier) => void;
  setSelfieCredential: (c: SelfieCredential | null) => void;
  setVerifiedOnly: (v: boolean) => void;
  addMatch: (p: Profile) => void;
  unlockFirstMessage: (profileId: string) => void;
  sendMessage: (profileId: string, text: string, viaAgent?: boolean) => void;
  updateAgent: (patch: Partial<AgentConfig>) => void;
  logAgentAction: (a: Omit<AgentAction, 'id' | 'at'>) => void;
  revokeAgentAction: (id: string) => void;
  toggleRsvp: (eventId: string) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<VerificationTier>(CURRENT_USER.tier);
  const [selfieCredential, setSelfieCredential] = useState<SelfieCredential | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [rsvpEvents, setRsvpEvents] = useState<string[]>([]);
  const [agent, setAgent] = useState<AgentConfig>({
    registered: false,
    walletAddress: null,
    icebreakerStyle: 'warm',
    dealbreakers: [],
    autoSuggest: true,
  });
  const [agentLog, setAgentLog] = useState<AgentAction[]>([]);

  const value = useMemo<AppState>(
    () => ({
      tier,
      selfieCredential,
      verifiedOnly,
      matches,
      agent,
      agentLog,
      rsvpEvents,
      setTier,
      setSelfieCredential,
      setVerifiedOnly,
      addMatch: (p) =>
        setMatches((prev) =>
          prev.some((m) => m.profile.id === p.id)
            ? prev
            : [...prev, { profile: p, firstMessageUnlocked: false, messages: [] }]
        ),
      unlockFirstMessage: (profileId) =>
        setMatches((prev) =>
          prev.map((m) => (m.profile.id === profileId ? { ...m, firstMessageUnlocked: true } : m))
        ),
      sendMessage: (profileId, text, viaAgent) =>
        setMatches((prev) =>
          prev.map((m) =>
            m.profile.id === profileId
              ? { ...m, messages: [...m.messages, { from: 'me', text, viaAgent, at: Date.now() }] }
              : m
          )
        ),
      updateAgent: (patch) => setAgent((prev) => ({ ...prev, ...patch })),
      logAgentAction: (a) =>
        setAgentLog((prev) => [{ ...a, id: `act_${Date.now()}`, at: Date.now() }, ...prev]),
      revokeAgentAction: (id) => setAgentLog((prev) => prev.filter((a) => a.id !== id)),
      toggleRsvp: (eventId) =>
        setRsvpEvents((prev) =>
          prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
        ),
    }),
    [tier, selfieCredential, verifiedOnly, matches, agent, agentLog, rsvpEvents]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { DISCOVERY_DECK };
