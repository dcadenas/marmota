import { db } from './database';
import { DexieReadStateStore } from './read-state-store';
import { DexieProfileStore } from './profile-store';

export const readStateStore = new DexieReadStateStore(db);
export const profileStore = new DexieProfileStore(db);
