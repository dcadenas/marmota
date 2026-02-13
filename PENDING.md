# Pending Items

Track what needs to be done. Remove items as they're completed.

---

## Important (Fix Before Real Use)

### 25. Multi-Device Support
**Status:** No protocol support — MLS is device-centric
**Severity:** High (UX)

Logging into the same Nostr account on a second browser/device shows no groups. MLS treats
each device as a separate member (leaf node in the ratchet tree). All group state (epoch keys,
ratchet tree) lives in IndexedDB and is device-local. There is no group discovery mechanism
in the Marmot protocol — no MIP addresses multi-device.

**Why it happens:**
- Key packages are generated per-device on first sign-in
- Welcome messages are delivered to the device that was invited
- MLS group state cannot be shared between devices without breaking forward secrecy
- There is no event kind to advertise "this pubkey is in these groups"

**Possible approaches (all require protocol-level work):**
1. **Self-invite:** Device A invites Device B's key package into each group. Requires a
   "Link Device" flow where the user pairs devices and the primary device re-invites.
2. **Group discovery event:** A new Nostr event kind listing the user's group memberships
   (encrypted to self). Device B reads it, fetches Welcome history, and joins.
3. **State export/import:** Transfer serialized MLS state between devices. Breaks forward
   secrecy assumptions — two devices with the same leaf key violate MLS guarantees.

**References:**
- Marmot spec has no multi-device MIP: https://github.com/marmot-protocol/marmot
- Whitenoise (reference app) does not address multi-device either
- marmot-ts PR #38 adds `GroupHistoryStore` for relay-based message history, but still
  requires MLS group state to decrypt

---

## Nice to Have (Polish)

### 15. Group List Search/Filter
Large group lists have no search. Render all groups unconditionally.

### 16. Offline Message Queue
Messages typed while offline are lost. Could queue locally and retry on reconnect.

### 17. Profile Caching
`use-profile.ts` always hits relays. Could check Dexie first and skip relay query if recent.

### 18. Typing Indicators
No "User X is typing..." — would need ephemeral events or a custom event kind.

### 19. Message Reactions
No emoji reactions on messages. Would require NIP-25 (kind:7) integration.

### 20. Message Editing / Deletion
Messages are immutable once sent. No NIP-09 delete or edit support.

### 21. Threads / Replies
All messages are flat. No reply-to threading (NIP-10 tags).

### 22. Read Receipts
No delivery/read indicators for other members.

### 23. Image Upload
Only renders image URLs. No in-app upload, paste, or drag-and-drop.

### 24. Data Export / Backup
All data is in IndexedDB. Clearing browser data loses everything. No export feature.

---

## Upstream Dependencies (Blocked by marmot-ts)

### 1. Non-Admin Self-Update Commits (Forward Secrecy)
**Status:** Blocked by marmot-ts
**Severity:** Low (security hardening, not functional)
**File:** `src/hooks/use-marmot-subscription.ts` (post-join commit in `processInvites`)

The [Marmot protocol spec](https://github.com/marmot-protocol/marmot) requires that after
joining a group via Welcome, members perform a self-update commit to rotate their leaf node
keys away from the published KeyPackage credentials:

- **MIP-02** ([PR #28](https://github.com/marmot-protocol/marmot/pull/28)): Adds mandatory
  post-join self-update requirement. Must happen within 24 hours, recommended immediately.
- **MIP-03** ([PR #23](https://github.com/marmot-protocol/marmot/pull/23)): Allows non-admin
  members to create self-update commits containing only an Update proposal for their own LeafNode.

However, [`marmot-ts`](https://github.com/verse-pbc/marmot-ts) currently has a blanket admin
check in `MarmotGroup.commit()` (line ~446) that rejects all commits from non-admin members,
including valid self-update commits.

**Current behavior:**
- **Admins** (group creators): Self-update works — empty commit advances the epoch.
- **Non-admins** (invited members): `group.commit()` throws `"Not a group admin"`, caught
  silently. The member keeps KeyPackage-derived keys until the next admin epoch advance.

**When marmot-ts fixes this:**
1. Remove the try/catch guard in `processInvites()` and let errors propagate
2. Verify epoch advances by 1 after join
3. Verify commit contains only an Update proposal for the joiner's own LeafNode

**References:**
- Spec: https://github.com/marmot-protocol/marmot
- Library: https://github.com/verse-pbc/marmot-ts
- ts-mls supports empty commits natively
- Threat model T.7.6 (init_key retention) and T.7.7 (delayed self-update) — both HIGH

### 2. init_key Secure Deletion
**Status:** Unknown — depends on marmot-ts / ts-mls internals
**Severity:** Low (defense-in-depth)

MIP-02 requires that after processing a Welcome, the private init_key from the consumed
KeyPackage must be securely deleted from local storage. Verify that `joinGroupFromWelcome()`
properly purges the init_key from `keyPackageStore`.

### 3. KeyPackage Relay Cleanup
**Status:** Not implemented
**Severity:** Low

MIP-02 recommends that after a KeyPackage is consumed via Welcome, the corresponding kind:443
event should be removed from relays (NIP-09 deletion event). Currently we only rotate locally
but don't delete the consumed one from relays. Stale KeyPackages could cause failed invites.
