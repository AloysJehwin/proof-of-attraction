# ETHOnline 2026 — World Track Submission

**Project:** Proof of Attraction
**Track:** World — $7,000 prize pool
**Team contact:** aloysjehwin@gmail.com
**Hackathon:** ETHOnline 2026

---

## Project Summary

Proof of Attraction is a React Native mobile dating app where human verification is a first-class trust primitive — not a checkbox, but a signal woven into every interaction. Every match, message, and RSVP is gated behind verifiable proof that a real, unique human is behind the screen.

The app targets both World prizes simultaneously:
- **AgentKit Continuity** — users can authorize a human-backed AI agent to act on their behalf (pre-screen matches, send icebreakers), with full AgentBook resolution and disclosure to the other party
- **Selfie Check** — liveness and continuity verification gates first messages and event RSVPs, used as an abuse-prevention and fairness signal

---

## Prize Targets

### AgentKit Continuity — $3,500

**How we use AgentKit:**

Users authorize a personal AI agent that acts on their behalf **in chat** — suggesting and, with consent, sending icebreakers to matches. What makes this a genuine AgentKit integration rather than a cosmetic chatbot: **every agent action routes through our own AgentKit-protected backend endpoint** via `agentkit.fetch()`. Before the agent can read a match's context, generate an opener, or post on the user's behalf, our Hono server runs `createAgentBookVerifier` to confirm the caller is a registered, World ID-verified, human-backed agent. Bots and unregistered scripts are rejected (or fall through to the x402 payment path); only human-backed agents pass. The recipient always sees a disclosure badge resolved from AgentBook.

So the user *sees* an in-chat agent; the *plumbing* is real x402 + AgentBook verification on every call.

**Features:**
- Agent registration flow: `npx @worldcoin/agentkit-cli register <wallet>` triggered in-app via deep link
- Protected chat-agent backend: `/agent/context`, `/agent/icebreaker`, `/agent/send` gated by `agentkitResourceServerExtension` + `declareAgentkitExtension`
- Per-call verification: `createAgentBookVerifier` inside `createAgentkitHooks` resolves agent wallet → anonymous human identifier on World Chain
- "Sent by [Name]'s agent (World ID verified human)" disclosure banner in chat
- Agent authorization screen: set preferences, icebreaker style, deal-breakers
- Agent action log: user can review and revoke any agent action (backed by nonce/usage storage)
- Free-trial mode: 3 free requests per **verified human** (durable quota shared across all of that human's agents and sessions) before an x402-style payment fallback

**Continuity model:** the free-trial quota is keyed to the authenticated human's Selfie Check nullifier, not to an agent wallet. A user's second or third agent draws down the same shared quota, and the count survives across sessions and serverless cold starts because it lives in Upstash Redis. This is the durable, per-human continuity the prize asks for.

**Technical stack:**
- `@worldcoin/agentkit` — agent client (`createAgentkitClient` → `agentkit.fetch()`)
- `@worldcoin/agentkit-cli` — `register` / `status <agent-address>`
- `createAgentBookVerifier`, `createAgentkitHooks`, `agentkitResourceServerExtension`, `declareAgentkitExtension` — server-side
- x402-style 402 boundary with Hono backend; settlement is a native testnet transfer (see On-chain settlement below)
- World Chain (`eip155:480`) for canonical AgentBook resolution
- Upstash Redis for durable per-human usage counters and nonces (replay protection), so quota persists on stateless Vercel

**Qualification checklist:**
- [x] Uses AgentKit in a meaningful way
- [x] Working app demo
- [x] Registers and resolves agents through AgentBook
- [x] Uses World ID Sandbox App for testing
- [ ] Feedback document (see `docs/FEEDBACK_AGENTKIT.md`)

---

### Authentication flow

There is no standalone "Sign in with World ID" session product; IDKit and Selfie Check produce a one-shot proof, not a session. Our flow:

1. Client runs the Selfie Check proof and forwards the result to the backend (`POST /auth/selfie`).
2. Backend verifies the proof and issues our own signed JWT keyed to the proof's nullifier hash. The nullifier is the stable user identity and is recorded in Redis for Sybil resistance (one account per verified human).
3. Client stores the JWT in `expo-secure-store` and attaches it as a Bearer token to every protected request. Session lifecycle is ours to manage; `POST /auth/refresh` re-issues.

The derived `humanId` from that nullifier is exactly the key the AgentKit quota counts against, tying agent continuity to the verified human.

---

### On-chain settlement (testnet only)

The documented x402 USDC facilitator is World Chain mainnet only. This is a hackathon build, so all on-chain activity is **testnet only, never mainnet**. When the free-trial quota is exhausted, the agent settles the 402 with a native ETH transfer on **World Chain Sepolia (chain id 4801)** from a Privy embedded wallet:

1. The 402 response carries the top-up target address, minimum value, and chain id.
2. The user signs a native ETH transfer from their Privy embedded wallet via viem.
3. The client reports the tx hash to `POST /agent/topup`; the backend verifies the receipt over the Sepolia RPC (recipient, minimum value, and unused hash for replay protection) and credits N more calls to that human's quota in Redis.
4. The agent retries and resumes. A Worldscan Sepolia link is surfaced in the chat.

Faucet (`alchemy.com/faucets/world-chain-sepolia`) is linked in-app so the demo wallet can be funded. Explorer: `sepolia.worldscan.org`.

---

### Selfie Check — $3,500

**How we use Selfie Check:**

Selfie Check is used as a risk and abuse-prevention signal at two high-stakes moments:
1. **First message gate** — before a user sends their first message to a match, Selfie Check confirms liveness and continuity (the person messaging is the same person who enrolled)
2. **Event RSVP gate** — before RSVPing to a limited-capacity event, Selfie Check confirms the same human who created the profile is claiming the spot

Both use cases directly map to Selfie Check's three core capabilities: liveness detection, abuse resistance, and continuity verification.

**On gender — explicitly not a World signal.** Selfie Check returns only a proof of a completed liveness/continuity check; it exposes no demographics, and no World credential verifies gender. The app shows an optional gender value that is a **third-party ML estimate** inferred from the selfie, entirely separate from World's stack. It is always labeled "estimated", never "verified", and is visually distinct from the Selfie Check human-verification badge. We do not and will not claim World-verified gender.

**Features:**
- Selfie Check enrollment inline on first match action (no Orb required — World ID App only)
- 90-day validity tracking: profile shows credential expiry, triggers re-verify CTA when expired
- `require_user_presence: true` for high-trust moments (fresh liveness against enrolled credential)
- Humanity badge on every profile: Unverified / Selfie Verified / Orb Verified
- Filter in discovery: "Verified humans only" (Selfie Check minimum)
- `signal` parameter bound to user ID to prevent proof replay across accounts

**Technical stack:**
- `@worldcoin/idkit` — `selfieCheckLegacy` preset (World ID 3.0; v4.0 not yet supported)
- `IDKitRequestWidget` for React Native integration
- Backend: forward IDKit result to World verification endpoint
- Sandbox: tested via TestFlight / private Play Store link

**Qualification checklist:**
- [x] Uses Selfie Check in a meaningful way
- [x] Treats Selfie Check as a risk, eligibility, fairness, continuity, and abuse-prevention signal
- [x] Working app demo
- [ ] Feedback document (see `docs/FEEDBACK_SELFIECHECK.md`)

---

## App Architecture

```
Proof of Attraction
├── Mobile: React Native (Expo), standalone (not a Mini App)
├── Backend: Hono on Vercel serverless (local dev via @hono/node-server)
├── Auth: Selfie Check proof -> our JWT keyed to nullifier (expo-secure-store)
├── State: Upstash Redis (durable per-human quota, nonces, nullifiers)
├── Wallet: Privy embedded wallet + viem
├── Agent registry: AgentBook on World Chain (eip155:480)
├── Chain: World Chain Sepolia testnet (id 4801) for top-up settlement
└── Sandbox: World ID Sandbox App
```

### Screens

| Screen | World Integration |
|--------|------------------|
| Onboarding | World ID signup, Selfie Check enrollment |
| Profile | Humanity badge, agent disclosure, credential expiry |
| Discovery | Verified-only filter, card swipe |
| Match | Selfie Check gate on first message |
| Chat | AgentBook lookup, agent disclosure banner |
| Agent Setup | AgentKit registration, preference config, action log |
| Events | Selfie Check RSVP gate, event-scoped discovery |

### Human Verification Tiers

| Tier | Technology | Trust Level |
|------|-----------|-------------|
| Unverified | — | Restricted (view only) |
| Selfie Verified | Selfie Check (`selfieCheckLegacy`) | Medium — liveness + continuity |
| Orb Verified | World ID Proof of Human | High — unique anonymous biometric |

---

## Key Technical Decisions

**`selfieCheckLegacy` over newer presets:** World ID v4.0 support is not yet available for Selfie Check; we use the v3.0 `selfieCheckLegacy` preset as documented.

**AgentBook resolution is always on World Chain:** Even if an agent submits requests from Base, the canonical AgentBook lives on World Chain. Our backend calls World Chain for all verifications.

**`signal` bound to user ID:** Every Selfie Check and World ID proof binds the `signal` field to the authenticated user's internal ID, preventing cross-account proof reuse.

**First-message gate, not signup gate:** Selfie Check at signup would block cold users mid-onboarding. Gating it at first message preserves conversion while still protecting against abuse at the moment it matters most.

---

## Feedback Documents

Required by both prizes. Covers:
- Docs and integration flow experience
- Developer Portal: navigation, search, product discovery, debugging
- Sandbox App: states, proof flows, test users, errors, edge cases
- What was confusing, missing, broken, or hard to test

See:
- [`docs/FEEDBACK_AGENTKIT.md`](./FEEDBACK_AGENTKIT.md)
- [`docs/FEEDBACK_SELFIECHECK.md`](./FEEDBACK_SELFIECHECK.md)

*(Feedback documents to be completed during and after integration)*

---

## Resources

| Resource | URL |
|----------|-----|
| AgentKit integration guide | https://docs.world.org/agents/agent-kit/integrate |
| AgentBook registration | https://docs.world.org/agents/agent-kit/integrate#step-2-register-the-agent-in-agentbook |
| AgentKit GitHub | https://github.com/worldcoin/agentkit |
| Selfie Check credential | https://docs.world.org/world-id/credentials/11 |
| Selfie Check IDKit | https://docs.world.org/world-id/idkit/credentials#selfie-check-beta |
| Selfie Check sandbox testing | https://docs.world.org/world-id/sandbox/testing-selfie-check |
| World Developer Portal | https://developer.world.org |
| World Docs | https://docs.world.org |
| Sandbox access form | https://forms.gle/mqbaiwMvX5MzmKdY8 |
