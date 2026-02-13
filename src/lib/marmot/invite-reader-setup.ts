import { InviteReader } from 'marmot-ts';
import type { EventSigner } from 'applesauce-core';
import { createInviteStore } from './dexie-invite-store';

/**
 * Creates an InviteReader with Dexie-backed storage.
 */
export function createInviteReader(signer: EventSigner): InviteReader {
  return new InviteReader({
    signer,
    store: createInviteStore(),
  });
}
