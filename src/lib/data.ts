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

export const CURRENT_USER: Profile = {
  id: 'user_self',
  name: 'You',
  age: 27,
  bio: 'Building at ETHOnline. Coffee, climbing, late-night debugging.',
  interests: ['crypto', 'climbing', 'coffee', 'design'],
  photo: 'https://i.pravatar.cc/400?img=12',
  tier: 'unverified',
  hasAgent: false,
  distanceKm: 0,
};

export const DISCOVERY_DECK: Profile[] = [
  {
    id: 'p1',
    name: 'Mara',
    age: 26,
    bio: 'Product designer. I sketch on napkins and ship on Fridays.',
    interests: ['design', 'coffee', 'running'],
    photo: 'https://i.pravatar.cc/400?img=45',
    tier: 'orb',
    hasAgent: true,
    distanceKm: 2,
  },
  {
    id: 'p2',
    name: 'Devin',
    age: 29,
    bio: 'Solidity by day, jazz piano by night.',
    interests: ['crypto', 'music', 'chess'],
    photo: 'https://i.pravatar.cc/400?img=33',
    tier: 'selfie',
    hasAgent: false,
    distanceKm: 5,
  },
  {
    id: 'p3',
    name: 'Yuki',
    age: 24,
    bio: 'Bouldering, ramen maps, and long walks to nowhere.',
    interests: ['climbing', 'food', 'travel'],
    photo: 'https://i.pravatar.cc/400?img=47',
    tier: 'selfie',
    hasAgent: true,
    distanceKm: 8,
  },
  {
    id: 'p4',
    name: 'Sam',
    age: 31,
    bio: 'Unverified newcomer. Say hi.',
    interests: ['photography', 'coffee'],
    photo: 'https://i.pravatar.cc/400?img=15',
    tier: 'unverified',
    hasAgent: false,
    distanceKm: 12,
  },
  {
    id: 'p5',
    name: 'Priya',
    age: 28,
    bio: 'Data science, spicy food, and terrible puns.',
    interests: ['data', 'food', 'hiking'],
    photo: 'https://i.pravatar.cc/400?img=32',
    tier: 'orb',
    hasAgent: false,
    distanceKm: 3,
  },
];

export type EventItem = {
  id: string;
  title: string;
  venue: string;
  date: string;
  attendees: number;
  capacity: number;
};

export const EVENTS: EventItem[] = [
  { id: 'e1', title: 'ETHOnline Rooftop Mixer', venue: 'Downtown', date: 'Fri 8pm', attendees: 42, capacity: 60 },
  { id: 'e2', title: 'Climbing + Coffee Meetup', venue: 'Boulder Gym', date: 'Sat 10am', attendees: 18, capacity: 20 },
  { id: 'e3', title: 'Verified Humans Speed Date', venue: 'The Loft', date: 'Sun 6pm', attendees: 28, capacity: 30 },
];
