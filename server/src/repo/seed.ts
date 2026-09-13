import type { ProfileRow } from './types.js';

export type SeedUser = {
  id: string;
  nullifierHash: string;
  tier: string;
  profile: Omit<ProfileRow, 'userId'>;
  likesEveryone: boolean;
};

export const SEED_USERS: SeedUser[] = [
  {
    id: 'seed_mara',
    nullifierHash: 'seed_null_mara',
    tier: 'orb',
    likesEveryone: true,
    profile: {
      name: 'Mara',
      age: 26,
      bio: 'Product designer. I sketch on napkins and ship on Fridays.',
      interests: ['design', 'coffee', 'running'],
      photos: ['https://i.pravatar.cc/400?img=45'],
      hasAgent: true,
      gender: 'woman',
      lookingFor: 'men',
      lat: 40.7128,
      lng: -74.006,
    },
  },
  {
    id: 'seed_devin',
    nullifierHash: 'seed_null_devin',
    tier: 'selfie',
    likesEveryone: true,
    profile: {
      name: 'Devin',
      age: 29,
      bio: 'Solidity by day, jazz piano by night.',
      interests: ['crypto', 'music', 'chess'],
      photos: ['https://i.pravatar.cc/400?img=33'],
      hasAgent: false,
      gender: 'man',
      lookingFor: 'women',
      lat: 40.72,
      lng: -74.0,
    },
  },
  {
    id: 'seed_yuki',
    nullifierHash: 'seed_null_yuki',
    tier: 'selfie',
    likesEveryone: false,
    profile: {
      name: 'Yuki',
      age: 24,
      bio: 'Bouldering, ramen maps, and long walks to nowhere.',
      interests: ['climbing', 'food', 'travel'],
      photos: ['https://i.pravatar.cc/400?img=47'],
      hasAgent: true,
      gender: 'woman',
      lookingFor: 'everyone',
      lat: 40.73,
      lng: -73.99,
    },
  },
];

export type SeedEvent = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  capacity: number;
};

export const SEED_EVENTS: SeedEvent[] = [
  { id: 'seed_e1', title: 'ETHOnline Rooftop Mixer', venue: 'Downtown', startsAt: 'Fri 8pm', capacity: 60 },
  { id: 'seed_e2', title: 'Climbing + Coffee Meetup', venue: 'Boulder Gym', startsAt: 'Sat 10am', capacity: 20 },
  { id: 'seed_e3', title: 'Verified Humans Speed Date', venue: 'The Loft', startsAt: 'Sun 6pm', capacity: 30 },
];
