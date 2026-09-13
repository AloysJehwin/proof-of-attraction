import { VerificationTier } from '../verification/tiers';

export type Profile = {
  id: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  photo: string;
  tier: VerificationTier;
  hasAgent: boolean;
  distanceKm: number;
};

export const SELF_USER_ID = 'user_self';
