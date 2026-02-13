# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install          # Install deps (runs preinstall to clone+build marmot-ts into vendor/)
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run (unit tests)
npm run test:e2e     # playwright test (requires Docker for local relay)
```

Single E2E test: `npx playwright test e2e/login.spec.ts`
Single unit test: `npx vitest run src/hooks/__tests__/some-test.ts`

## Architecture

### Protocol Stack

Marmota is an E2E encrypted group chat using MLS (Messaging Layer Security) over Nostr relays, implemented by the [Marmot protocol](https://github.com/marmot-protocol/marmot). The key event kinds are:

- **443** — KeyPackage (public MLS credentials)
- **444** — Welcome (encrypted group invite)
- **445** — Group events (MLS commits + application messages)
- **1059** — Gift wrap (NIP-59, wraps Welcome messages)
- **10051** — Relay list (NIP-65, inbox relays)

### Data Flow

**Central orchestrator: `src/hooks/use-marmot-subscription.ts`** — This is the heartbeat. It:
1. Subscribes to kind:1059 gift wraps → decrypts via InviteReader
2. Processes invites: `joinGroupFromWelcome()` → attempts post-join self-update
3. Opens per-group kind:445 subscriptions with backfill (7-day cap), dedup (1000 IDs), and batched processing (100ms flush)
4. Watches for new groups via MarmotClient events
5. Tears down and re-establishes all subscriptions on reconnection

**Message sending:** `use-send-message.ts` → `group.sendApplicationRumor()` → publishes kind:445

**Group creation:** `use-create-group.ts` → `marmotClient.createGroup()` → invites members via key package lookup + Welcome gift wraps

### Auth Flow

`src/context/auth-context.tsx` manages the `NIP44Signer` lifecycle. Multiple login methods (NIP-07 extension, NIP-46 bunker, nsec, diVine OAuth) all produce a signer. On login, a `MarmotClient` and `InviteReader` are created. Sessions persist to localStorage (except nsec). User-switch detection via `marmota:lastPubkey` clears stale IndexedDB data.

### Storage

Dexie (IndexedDB) in `src/lib/storage/database.ts`. Key tables: `messages`, `groups`, `groupStates` (serialized MLS state), `keyPackages`, `inviteReceived`/`inviteUnread`/`inviteSeen`, `readState`, `profiles`. TanStack Query handles async state on top.

### Marmot Integration

`src/lib/marmot/` wraps marmot-ts:
- **`SimplePoolNetworkInterface`** adapts nostr-tools SimplePool to marmot-ts's `NostrNetworkInterface`
- **`message-processor.ts`** ingests group events → persists messages to Dexie → invalidates queries
- **`key-package-publisher.ts`** publishes kind:443 key packages with throttled rotation (30s cooldown)
- Dexie backends (`dexie-kv-backend.ts`, etc.) provide persistent storage for MLS state

### Relay Configuration

`src/lib/relay/defaults.ts` defines three relay lists (DM, metadata, MLS). All are overridden by `VITE_RELAY_URL` env var during E2E tests.

## Critical API Gotcha

nostr-tools `SimplePool` methods take a **single Filter object**, never `Filter[]`:
```ts
pool.subscribeMany(relays, filter, opts)  // filter: Filter, NOT Filter[]
pool.querySync(relays, filter)            // filter: Filter, NOT Filter[]
```

## marmot-ts Dependency

`marmot-ts` has no npm release. The `preinstall` script (`scripts/setup-marmot-ts.mjs`) clones from GitHub, pins to a specific commit, and builds locally into `vendor/marmot-ts`. The commit hash is in that script.

## E2E Tests

Require Docker. A local Nostr relay (`ghcr.io/verse-pbc/relay_builder:latest`) runs on port 8080. Global setup does a WebSocket health check (Nostr REQ→EOSE), not just a TCP port check. Test helpers in `e2e/helpers.ts` provide `generateUser()`, `loginWithNsec()`, `createGroup()`, `sendMessage()`.

## Deployment

Pushes to `master` auto-deploy to Cloudflare Pages (groups.privdm.com) via `.github/workflows/deploy.yml`.
