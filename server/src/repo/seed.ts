import type { ProfileRow } from './types.js';

export type SeedUser = {
  id: string;
  nullifierHash: string;
  tier: string;
  handle: string;
  profile: Omit<ProfileRow, 'userId'>;
  likesEveryone: boolean;
};

// Spread around NYC so distance scoring varies.
export const SEED_USERS: SeedUser[] = [
  {
    id: 'seed_mara',
    nullifierHash: 'seed_null_mara',
    tier: 'orb',
    handle: 'mara',
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
    tier: 'orb',
    handle: 'devin',
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
    tier: 'orb',
    handle: 'yuki',
    likesEveryone: true,
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
  {
    id: 'seed_arjun',
    nullifierHash: 'seed_null_arjun',
    tier: 'orb',
    handle: 'arjun',
    likesEveryone: true,
    profile: {
      name: 'Arjun',
      age: 31,
      bio: 'Backend engineer who runs a very small hot sauce company.',
      interests: ['cooking', 'crypto', 'cycling'],
      photos: ['https://i.pravatar.cc/400?img=12'],
      hasAgent: true,
      gender: 'man',
      lookingFor: 'everyone',
      lat: 40.706,
      lng: -73.97,
    },
  },
  {
    id: 'seed_lena',
    nullifierHash: 'seed_null_lena',
    tier: 'orb',
    handle: 'lena',
    likesEveryone: true,
    profile: {
      name: 'Lena',
      age: 27,
      bio: 'Documentary editor. Ask me about the 11 hours of B-roll I cannot cut.',
      interests: ['film', 'photography', 'coffee'],
      photos: ['https://i.pravatar.cc/400?img=31'],
      hasAgent: false,
      gender: 'woman',
      lookingFor: 'everyone',
      lat: 40.741,
      lng: -73.989,
    },
  },
  {
    id: 'seed_tom',
    nullifierHash: 'seed_null_tom',
    tier: 'selfie',
    handle: 'tom',
    likesEveryone: true,
    profile: {
      name: 'Tom',
      age: 33,
      bio: 'Ex-chef turned data analyst. Still salt everything correctly.',
      interests: ['food', 'running', 'music'],
      photos: ['https://i.pravatar.cc/400?img=52'],
      hasAgent: false,
      gender: 'man',
      lookingFor: 'women',
      lat: 40.688,
      lng: -73.95,
    },
  },
  {
    id: 'seed_priya',
    nullifierHash: 'seed_null_priya',
    tier: 'orb',
    handle: 'priya',
    likesEveryone: true,
    profile: {
      name: 'Priya',
      age: 25,
      bio: 'ML researcher. I make models that are wrong in interesting ways.',
      interests: ['ai', 'chess', 'travel'],
      photos: ['https://i.pravatar.cc/400?img=26'],
      hasAgent: true,
      gender: 'woman',
      lookingFor: 'men',
      lat: 40.75,
      lng: -73.98,
    },
  },
  {
    id: 'seed_noah',
    nullifierHash: 'seed_null_noah',
    tier: 'orb',
    handle: 'noah',
    likesEveryone: true,
    profile: {
      name: 'Noah',
      age: 28,
      bio: 'Climbing gym regular. Will absolutely talk about knots too long.',
      interests: ['climbing', 'travel', 'design'],
      photos: ['https://i.pravatar.cc/400?img=15'],
      hasAgent: false,
      gender: 'man',
      lookingFor: 'everyone',
      lat: 40.717,
      lng: -73.956,
    },
  },
  {
    id: 'seed_sofia',
    nullifierHash: 'seed_null_sofia',
    tier: 'selfie',
    handle: 'sofia',
    likesEveryone: true,
    profile: {
      name: 'Sofia',
      age: 30,
      bio: 'Architect. I judge buildings and, mildly, your bookshelf.',
      interests: ['design', 'art', 'cycling'],
      photos: ['https://i.pravatar.cc/400?img=49'],
      hasAgent: true,
      gender: 'woman',
      lookingFor: 'everyone',
      lat: 40.697,
      lng: -73.99,
    },
  },
  {
    id: 'seed_kai',
    nullifierHash: 'seed_null_kai',
    tier: 'orb',
    handle: 'kai',
    likesEveryone: true,
    profile: {
      name: 'Kai',
      age: 23,
      bio: 'Music producer. Send me a field recording and I will loop it.',
      interests: ['music', 'art', 'food'],
      photos: ['https://i.pravatar.cc/400?img=68'],
      hasAgent: false,
      gender: 'nonbinary',
      lookingFor: 'everyone',
      lat: 40.724,
      lng: -73.977,
    },
  },
  {
    id: 'seed_elena',
    nullifierHash: 'seed_null_elena',
    tier: 'orb',
    handle: 'elena',
    likesEveryone: true,
    profile: {
      name: 'Elena',
      age: 32,
      bio: 'Marathoner, terrible at rest days. Coffee is a food group.',
      interests: ['running', 'coffee', 'travel'],
      photos: ['https://i.pravatar.cc/400?img=44'],
      hasAgent: true,
      gender: 'woman',
      lookingFor: 'men',
      lat: 40.762,
      lng: -73.971,
    },
  },
  {
    id: 'seed_marcus',
    nullifierHash: 'seed_null_marcus',
    tier: 'selfie',
    handle: 'marcus',
    likesEveryone: true,
    profile: {
      name: 'Marcus',
      age: 35,
      bio: 'Bookstore owner. Yes, the cat has an Instagram.',
      interests: ['books', 'film', 'chess'],
      photos: ['https://i.pravatar.cc/400?img=59'],
      hasAgent: false,
      gender: 'man',
      lookingFor: 'everyone',
      lat: 40.679,
      lng: -73.944,
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
  { id: 'seed_e4', title: 'Sunrise Run Club', venue: 'Riverside Park', startsAt: 'Wed 6am', capacity: 40 },
  { id: 'seed_e5', title: 'Vinyl Listening Night', venue: 'Basement Records', startsAt: 'Thu 9pm', capacity: 25 },
  { id: 'seed_e6', title: 'Ramen Crawl', venue: 'East Village', startsAt: 'Sat 7pm', capacity: 16 },
];

// Opening lines used when seeding demo conversations.
export const SEED_OPENERS: string[] = [
  'ok your bio actually made me laugh, so: hi.',
  'we matched on climbing - gym or real rock?',
  'be honest, how many unread messages do you have right now',
  'your photo has excellent lighting and I need to know the secret',
  'I am contractually obligated to ask about the hot sauce.',
];

