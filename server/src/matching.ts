import type { PublicProfile } from './repo/types.js';

export const TIER_RANK: Record<string, number> = { unverified: 0, selfie: 1, orb: 2 };

export type OnchainSignals = {
  hasTransacted: boolean;
  balanceBand: number;
  agentRegistered: boolean;
};

export type ScoreBreakdown = {
  interest: number;
  age: number;
  distance: number;
  tier: number;
  reputation: number;
  agentBacked: number;
};

const WEIGHTS: ScoreBreakdown = {
  interest: 0.34,
  age: 0.12,
  distance: 0.14,
  tier: 0.14,
  reputation: 0.12,
  agentBacked: 0.14,
};

export function interestScore(a: string[], b: string[]): number {
  const sa = new Set(a.map((x) => x.toLowerCase().trim()).filter(Boolean));
  const sb = new Set(b.map((x) => x.toLowerCase().trim()).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function ageScore(selfAge: number, otherAge: number): number {
  if (!selfAge || !otherAge) return 0.5;
  return 1 / (1 + Math.abs(selfAge - otherAge) / 8);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function distanceScore(
  self: { lat: number | null; lng: number | null },
  other: { lat: number | null; lng: number | null },
): number {
  if (self.lat == null || self.lng == null || other.lat == null || other.lng == null) return 0.5;
  const km = haversineKm(self.lat, self.lng, other.lat, other.lng);
  return 1 / (1 + km / 25);
}

export function tierScore(tier: string): number {
  const rank = TIER_RANK[tier] ?? 0;
  return rank / 2;
}

export function reputationScore(s: OnchainSignals | null): number {
  if (!s) return 0.5;
  let v = 0;
  if (s.hasTransacted) v += 0.5;
  v += Math.min(0.3, s.balanceBand * 0.1);
  if (s.agentRegistered) v += 0.2;
  return Math.min(1, v);
}

export function agentBackedScore(hasAgent: boolean, agentRegistered: boolean): number {
  if (agentRegistered) return 1;
  return hasAgent ? 0.6 : 0.2;
}

export function scoreCandidate(
  self: PublicProfile,
  candidate: PublicProfile,
  onchain: OnchainSignals | null,
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    interest: interestScore(self.interests, candidate.interests),
    age: ageScore(self.age, candidate.age),
    distance: distanceScore(self, candidate),
    tier: tierScore(candidate.tier),
    reputation: reputationScore(onchain),
    agentBacked: agentBackedScore(candidate.hasAgent, Boolean(onchain?.agentRegistered)),
  };
  const score =
    breakdown.interest * WEIGHTS.interest +
    breakdown.age * WEIGHTS.age +
    breakdown.distance * WEIGHTS.distance +
    breakdown.tier * WEIGHTS.tier +
    breakdown.reputation * WEIGHTS.reputation +
    breakdown.agentBacked * WEIGHTS.agentBacked;
  return { score: Math.round(score * 1000) / 1000, breakdown };
}

const ONCHAIN_TOP_N = 12;

export async function rankDiscovery(
  self: PublicProfile | null,
  candidates: PublicProfile[],
  resolveSignals: (candidate: PublicProfile) => Promise<OnchainSignals | null>,
): Promise<PublicProfile[]> {
  if (!self) {
    return candidates.map((c) => ({ ...c, matchScore: 0 }));
  }
  const prelim = candidates
    .map((c) => ({ c, base: scoreCandidate(self, c, null) }))
    .sort((a, b) => b.base.score - a.base.score);

  const enriched = await Promise.all(
    prelim.map(async ({ c }, i) => {
      const signals = i < ONCHAIN_TOP_N ? await resolveSignals(c) : null;
      const { score } = scoreCandidate(self, c, signals);
      return { ...c, matchScore: score };
    }),
  );
  return enriched.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}
