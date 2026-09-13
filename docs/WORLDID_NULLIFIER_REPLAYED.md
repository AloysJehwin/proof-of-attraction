# World ID: `nullifier_replayed` — root cause and fix

## TL;DR

`nullifier_replayed` is **not a bug in our code**. In World ID 4.0 an action nullifier is
**one-time-use**. Once a given World ID has verified a given action, that same
(World ID + action) pair can **never** produce a new sign-up again.

To test sign-up again, **rotate the action**:

```bash
cd server
npm run reset:all        # wipes users AND rotates the action
npx expo start -c        # from repo root, so the new action is inlined
```

## What the error means

From the [official error codes](https://docs.world.org/world-id/idkit/error-codes):

| Code | Meaning | Guidance |
| --- | --- | --- |
| `nullifier_replayed` | Nullifier was already used for this action. | Treat as an **already-verified** outcome; do **not** retry the same action as a new verification. |
| `max_verifications_reached` | Action already verified the maximum allowed number of times. | Terminal business-rule outcome. |

A **nullifier** is "a unique identifier for a combination of a user, `app_id`, and `action`"
([concepts](https://docs.world.org/world-id/concepts)). Change any one of those and you get a
new nullifier.

## Why there is no "reset" switch

World ID 4.0 removed unlimited re-verification of a single action. From the
[4.0 migration guide](https://docs.world.org/world-id/4-0-migration):

> Nullifiers are one-time-use, and `session_id` is the stable link across requests.
> **Rule of thumb: use `nullifier` for one-time uniqueness and `session_id` for continuity.**

And for apps that want repeated verification of the same action:

> **Migration approach:** Migrate to Session Proofs, which let you verify credentials over a
> period of time while ensuring it's the same user. The session ID returned in the proof
> becomes the long-lived stable identifier instead.

So World deliberately offers **no** portal toggle to reset or unlimit an action's nullifiers.

## How this app is designed (and why it matched the docs)

We already follow World's recommended split:

| Purpose | Mechanism | Code |
| --- | --- | --- |
| One-time sign-up (uniqueness) | action nullifier | `POST /auth/selfie` in `server/src/index.ts` |
| Returning-user login (continuity) | **session proof** (`session_id`) | `/auth/session/create`, `/auth/session/lookup`, `/auth/session/prove` |

Client helpers live in `src/verification/selfieCheck.ts`
(`createWorldSession`, `lookupWorldSession`, `loginWithWorldSession`).

## The trap: wiping the database

Deleting our `users` rows **does not** delete World's memory of the nullifier. That creates a
dead end:

1. World says `nullifier_replayed` → we map it to `already_registered`, so sign-up is refused.
2. We fall back to session login — but the wipe deleted `users.world_session_id`.
3. Handle lookup returns 404 → the World ID is locked out of this action forever.

**Therefore: always rotate the action when you wipe the DB.** `npm run reset:all` now does both.

## Commands

```bash
cd server

npm run reset:all                      # wipe all users + rotate action  (recommended)
npm run reset:action                   # rotate the action only
npm run reset -- --handle yourhandle   # delete one account by handle
npm run reset -- --nullifier 0xabc...  # delete one account by nullifier
```

`EXPO_PUBLIC_*` values are **inlined at bundle time**, so after rotating you must restart Metro:

```bash
npx expo start -c
```

## Other ways to get a fresh identity

* **Sandbox account reset.** We point at Sandbox (`sandbox.world.org`). Sandbox supports
  [resettable accounts](https://docs.world.org/world-id/sandbox/what-is-sandbox):
  "Delete an account and sign up again as often as you need." A new sandbox account is a new
  user, hence a new nullifier — no action rotation needed.
* **A different World ID account** on the device.

## Production guidance

Do **not** rotate actions in production — that would let one human sign up repeatedly and break
the Sybil guarantee. In production the correct behaviour is exactly what we ship:
`nullifier_replayed` → "you already have an account" → send the user to **Log in with World ID**
(session proof).

