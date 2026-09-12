export type VerificationTier = 'unverified' | 'selfie' | 'orb';

export const TIER_RANK: Record<VerificationTier, number> = {
  unverified: 0,
  selfie: 1,
  orb: 2,
};

export const TIER_LABEL: Record<VerificationTier, string> = {
  unverified: 'Unverified',
  selfie: 'Selfie Verified',
  orb: 'Orb Verified',
};

export const SELFIE_VALIDITY_DAYS = 90;

export type SelfieCredential = {
  verifiedAt: number;
  signalUserId: string;
  nullifierHash: string;
};

export function isSelfieValid(cred: SelfieCredential | null, now = Date.now()): boolean {
  if (!cred) return false;
  const ageMs = now - cred.verifiedAt;
  return ageMs < SELFIE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
}

export function daysUntilExpiry(cred: SelfieCredential | null, now = Date.now()): number | null {
  if (!cred) return null;
  const expiresAt = cred.verifiedAt + SELFIE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));
}

export function meetsTier(actual: VerificationTier, required: VerificationTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}
