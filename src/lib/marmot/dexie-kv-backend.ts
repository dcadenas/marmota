import type Dexie from 'dexie';
import type { KVEntry } from '@/lib/storage/database';

/**
 * Generic Dexie-backed key-value store backend.
 * Structurally matches marmot-ts KeyValueStoreBackend<T> interface.
 * Works with any Dexie table that stores { key: string, value: T }.
 */
export class DexieKeyValueBackend<T> {
  constructor(private table: Dexie.Table<KVEntry<T>, string>) {}

  async getItem(key: string): Promise<T | null> {
    const entry = await this.table.get(key);
    return entry?.value ?? null;
  }

  async setItem(key: string, value: T): Promise<T> {
    await this.table.put({ key, value });
    return value;
  }

  async removeItem(key: string): Promise<void> {
    await this.table.delete(key);
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }

  async keys(): Promise<string[]> {
    return this.table.toCollection().primaryKeys() as Promise<string[]>;
  }
}
