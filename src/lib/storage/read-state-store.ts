import type { MarmotaDatabase } from './database';

export type ReadStateMap = Record<string, number>; // groupId → lastReadAt

export class DexieReadStateStore {
  constructor(private db: MarmotaDatabase) {}

  async getAll(): Promise<ReadStateMap> {
    const entries = await this.db.readState.toArray();
    const map: ReadStateMap = {};
    for (const entry of entries) {
      map[entry.groupId] = entry.lastReadAt;
    }
    return map;
  }

  async markRead(groupId: string, timestamp: number): Promise<void> {
    await this.db.transaction('rw', this.db.readState, async () => {
      const existing = await this.db.readState.get(groupId);
      if (existing && existing.lastReadAt >= timestamp) return;
      await this.db.readState.put({ groupId, lastReadAt: timestamp });
    });
  }

  /** Merge remote state with local, taking max(local, remote) per key. Returns merged result. */
  async bulkMerge(remote: ReadStateMap): Promise<ReadStateMap> {
    const local = await this.getAll();
    const merged: ReadStateMap = { ...local };

    const toWrite: { groupId: string; lastReadAt: number }[] = [];
    for (const [gId, remoteTs] of Object.entries(remote)) {
      const localTs = local[gId] ?? 0;
      const winner = Math.max(localTs, remoteTs);
      merged[gId] = winner;
      if (winner > localTs) {
        toWrite.push({ groupId: gId, lastReadAt: winner });
      }
    }

    if (toWrite.length > 0) {
      await this.db.readState.bulkPut(toWrite);
    }

    return merged;
  }
}
