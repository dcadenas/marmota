import type { KeyPackageStoreBackend } from 'marmot-ts';
import { db } from '@/lib/storage/database';
import { DexieKeyValueBackend } from './dexie-kv-backend';

/**
 * Creates a KeyPackageStoreBackend backed by Dexie.
 * StoredKeyPackage contains Uint8Array fields — IndexedDB handles these natively.
 */
export function createKeyPackageBackend(): KeyPackageStoreBackend {
  return new DexieKeyValueBackend(db.keyPackages) as unknown as KeyPackageStoreBackend;
}
