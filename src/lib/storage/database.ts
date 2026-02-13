import Dexie from 'dexie';

export interface StoredMessage {
  id: string;
  groupId: string;
  senderPubkey: string;
  content: string;
  createdAt: number;
  kind: number;
}

export interface StoredGroup {
  id: string;
  name: string;
  description?: string;
  members: string[];
  lastMessage?: StoredMessage;
  messageCount: number;
  createdAt: number;
  nostrGroupId?: string;
}

/** Generic key-value entry stored in Dexie */
export interface KVEntry<T> {
  key: string;
  value: T;
}

export interface SyncMetaEntry {
  key: string;
  value: number;
}

export interface ReadStateEntry {
  groupId: string;
  lastReadAt: number;
}

export interface StoredProfile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  createdAt: number;
}

const DB_NAME = 'marmota';

export class MarmotaDatabase extends Dexie {
  messages!: Dexie.Table<StoredMessage, string>;
  groups!: Dexie.Table<StoredGroup, string>;
  /** MLS group state bytes — KeyValueStoreBackend<SerializedClientState> */
  groupStates!: Dexie.Table<KVEntry<Uint8Array>, string>;
  /** MLS key packages — KeyValueStoreBackend<StoredKeyPackage> */
  keyPackages!: Dexie.Table<KVEntry<unknown>, string>;
  /** Received gift wraps awaiting decryption */
  inviteReceived!: Dexie.Table<KVEntry<unknown>, string>;
  /** Decrypted unread welcome rumors */
  inviteUnread!: Dexie.Table<KVEntry<unknown>, string>;
  /** Seen event IDs for deduplication */
  inviteSeen!: Dexie.Table<KVEntry<boolean>, string>;
  syncMeta!: Dexie.Table<SyncMetaEntry, string>;
  readState!: Dexie.Table<ReadStateEntry, string>;
  profiles!: Dexie.Table<StoredProfile, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      messages: 'id, groupId, createdAt',
      groups: 'id',
      groupStates: 'key',
      keyPackages: 'key',
      inviteReceived: 'key',
      inviteUnread: 'key',
      inviteSeen: 'key',
      syncMeta: 'key',
      readState: 'groupId',
      profiles: 'pubkey',
    });

    // No schema changes — establishes the migration pattern.
    // Future versions should copy the full store map and add an upgrade() handler:
    //   this.version(N).stores({...}).upgrade(tx => { ... });
    this.version(2).stores({});
  }
}

export const db = new MarmotaDatabase();
