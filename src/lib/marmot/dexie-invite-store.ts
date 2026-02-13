import type { InviteStore, ReceivedGiftWrap, UnreadInvite } from 'marmot-ts';
import { db } from '@/lib/storage/database';
import { DexieKeyValueBackend } from './dexie-kv-backend';

/**
 * Creates an InviteStore with Dexie-backed storage for all three states:
 * - received: encrypted gift wraps awaiting decryption
 * - unread: decrypted welcome rumors ready for consumption
 * - seen: event IDs for deduplication
 */
export function createInviteStore(): InviteStore {
  return {
    received: new DexieKeyValueBackend<ReceivedGiftWrap>(db.inviteReceived as never),
    unread: new DexieKeyValueBackend<UnreadInvite>(db.inviteUnread as never),
    seen: new DexieKeyValueBackend<boolean>(db.inviteSeen),
  };
}
