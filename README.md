# Marmota

End-to-end encrypted group messaging over Nostr using the [Marmot protocol](https://github.com/marmot-protocol/marmot) (MLS).

Live at [groups.privdm.com](https://groups.privdm.com).

## Stack

- React + TypeScript + Vite
- [marmot-ts](https://github.com/marmot-protocol/marmot-ts) — Marmot protocol implementation
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) — Nostr relay communication
- TanStack Query — async state management
- Dexie (IndexedDB) — local message and group storage
- Tailwind CSS

## Development

```sh
npm install
npm run dev
```

### E2E Tests

Requires Docker for the local relay:

```sh
npm run test:e2e
```

## Deployment

Pushes to `master` auto-deploy to Cloudflare Pages via GitHub Actions.
