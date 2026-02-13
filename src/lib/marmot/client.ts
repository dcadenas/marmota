import { MarmotClient, KeyPackageStore } from 'marmot-ts';
import type { EventSigner } from 'applesauce-core';
import type { NostrNetworkInterface } from 'marmot-ts';
import { createGroupStateBackend } from './dexie-group-state-backend';
import { createKeyPackageBackend } from './dexie-key-package-backend';

/**
 * Creates a fully configured MarmotClient with Dexie-backed storage.
 */
export function createMarmotClient(
  signer: EventSigner,
  network: NostrNetworkInterface,
): MarmotClient {
  const groupStateBackend = createGroupStateBackend();
  const keyPackageBackend = createKeyPackageBackend();
  const keyPackageStore = new KeyPackageStore(keyPackageBackend);

  return new MarmotClient({
    signer,
    groupStateBackend,
    keyPackageStore,
    network,
  });
}
