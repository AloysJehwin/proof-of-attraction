# Proof of Attraction

A React Native mobile dating app for ETHOnline 2026 where human verification is a first-class trust primitive. Every match, message, and RSVP is gated behind verifiable proof that a real, unique human is behind the screen, powered by World ID, Selfie Check, and AgentKit.

## World Prize Targets

- AgentKit Continuity ($3,500) human-backed AI agent authorization in chat and discovery
- Selfie Check ($3,500) liveness and continuity verification on first message and event RSVP

See [docs/TRACK.md](docs/TRACK.md) for full track submission details.

## Structure

```
app/                 Expo Router screens
  index.tsx          Onboarding and World ID verification
  (tabs)/            Discover, Matches, Events, Agent, Profile
  chat/[id].tsx      Chat with Selfie Check gate and agent disclosure
src/
  theme/             Dark-first design tokens
  verification/      Tier logic and Selfie Check wrapper
  agent/             AgentKit client wrapper
  components/        Shared UI primitives
  lib/               App state and mock data
server/              Hono backend, AgentKit-protected routes
docs/                Track doc and prize feedback docs
```

## Run the app

```
npm install
npx expo start
```

The World ID App deep-link flows need a dev build, not Expo Go:

```
npx expo run:ios
```

## Run the backend

```
cd server
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_WORLD_APP_ID`, `EXPO_PUBLIC_VERIFY_URL`, and `EXPO_PUBLIC_AGENT_API` once Selfie Check access and AgentKit are wired. Until then the app runs in simulation mode.

## Stack

- React Native (Expo SDK 57, Expo Router)
- World ID / IDKit (`selfieCheckLegacy`, World ID 3.0)
- AgentKit + AgentBook on World Chain (`eip155:480`)
- Node.js + Hono backend (x402)

## Contact

aloysjehwin@gmail.com
