import { KeyValueGroupStateBackend } from 'marmot-ts';
import type { GroupStateStoreBackend } from 'marmot-ts';
import { db } from '@/lib/storage/database';
import { DexieKeyValueBackend } from './dexie-kv-backend';

/**
 * Creates a GroupStateStoreBackend backed by Dexie.
 *
 * Uses marmot-ts's KeyValueGroupStateBackend adapter which converts
 * Uint8Array group IDs to hex string keys internally.
 */
export function createGroupStateBackend(): GroupStateStoreBackend {
  const kvBackend = new DexieKeyValueBackend<Uint8Array>(db.groupStates);
  return new KeyValueGroupStateBackend(kvBackend);
}
