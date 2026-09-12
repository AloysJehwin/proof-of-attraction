# AgentKit Feedback

Running log of the AgentKit integration developer experience, required by the AgentKit Continuity prize. Fill sections as we hit them during real integration.

## Integration flow

- Packages used: `@worldcoin/agentkit`, `@worldcoin/agentkit-cli`
- Functions: `createAgentkitClient`, `createAgentBookVerifier`, `createAgentkitHooks`, `agentkitResourceServerExtension`, `declareAgentkitExtension`
- CLI: `register` / `status <agent-address>`

Notes:
- (todo) How clear was the agent-side vs server-side split in the docs?
- (todo) Was the x402 relationship obvious, or did it require reading the x402 spec separately?
- (todo) `createAgentBookVerifier` setup: any missing config, unclear errors?

## AgentBook registration

- Command: `npx @worldcoin/agentkit-cli register <agent-address>`
- Resolution: always on World Chain `eip155:480`

Notes:
- (todo) World App verification prompt during registration: smooth or confusing?
- (todo) Nonce / replay handling: documented well enough?
- (todo) Time from register to resolvable in AgentBook?

## Developer Portal

- (todo) Navigation, search, product discovery
- (todo) Debugging guidance for failed agent verification

## Sandbox App

- (todo) States tested, proof flows, test users
- (todo) Errors and edge cases hit

## What was confusing, missing, broken, or hard to test

- (todo)
