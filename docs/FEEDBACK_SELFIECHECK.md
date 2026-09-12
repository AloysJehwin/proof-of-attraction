# Selfie Check Feedback

Running log of the Selfie Check integration developer experience, required by the Selfie Check prize. Fill sections as we hit them during real integration.

## Integration flow

- Package: `@worldcoin/idkit` (`selfieCheckLegacy` preset)
- World ID version: 3.0 only (4.0 not yet supported)
- Params used: `signal` (bound to user id), `action`, `require_user_presence`
- Widget: `IDKitRequestWidget`
- Access: requested from developers@toolsforhumanity.com using aloysjehwin@gmail.com

Notes:
- (todo) Was the `selfieCheckLegacy` vs newer preset distinction clear?
- (todo) Backend verification endpoint: documented request/response shape?
- (todo) 90-day validity and re-verify: how surfaced in the proof?

## Developer Portal

- (todo) Navigation, search, product discovery
- (todo) Debugging guidance for failed verifications

## Sandbox App

Test states from docs:
- Hot: World ID installed, enrolled or inline enroll then match
- Cold: full onboarding funnel then enroll
- Semi-cold: account recovery then Selfie Check

Notes:
- (todo) Which states did we actually test, on which entry surface (native / web)?
- (todo) iOS semi-cold invite-code limitation: did we hit it?
- (todo) Proof flows: same-device deep link vs cross-device QR handoff
- (todo) Test users, errors, edge cases

## What was confusing, missing, broken, or hard to test

- (todo)
