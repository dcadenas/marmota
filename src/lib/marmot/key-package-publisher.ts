import type { MarmotClient } from 'marmot-ts';
import {
  generateKeyPackage,
  createCredential,
  defaultCapabilities,
  createKeyPackageEvent,
  createKeyPackageRelayListEvent,
} from 'marmot-ts';
import type { CompleteKeyPackage } from 'marmot-ts';
import { getCiphersuiteImpl } from 'ts-mls';
import { getCiphersuiteFromId } from 'ts-mls/crypto/ciphersuite.js';
import { DEFAULT_MLS_RELAYS } from '@/lib/relay/defaults';

/**
 * Generates a new key package, stores it locally, and publishes it.
 */
async function generateAndPublishKeyPackage(client: MarmotClient): Promise<void> {
  const pubkey = await client.signer.getPublicKey();
  const credential = createCredential(pubkey);

  // Default ciphersuite: MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519 (id: 1)
  const suite = getCiphersuiteFromId(1);
  const ciphersuiteImpl = await getCiphersuiteImpl(suite, client.cryptoProvider);

  const keyPackage: CompleteKeyPackage = await generateKeyPackage({
    credential,
    capabilities: defaultCapabilities(),
    ciphersuiteImpl,
  });

  // Store locally
  await client.keyPackageStore.add(keyPackage);

  // Create and publish kind:443 key package event
  const kpEvent = createKeyPackageEvent({
    keyPackage: keyPackage.publicPackage,
    pubkey,
    relays: DEFAULT_MLS_RELAYS,
    client: 'marmota',
  });
  const signedKp = await client.signer.signEvent(kpEvent);
  await client.network.publish(DEFAULT_MLS_RELAYS, signedKp);
}

/**
 * Ensures the user has at least one published key package.
 * If no key packages exist in the store, generates one and publishes it.
 * Also publishes a kind:10051 relay list event.
 */
export async function ensureKeyPackagePublished(
  client: MarmotClient,
  minCount = 3,
): Promise<void> {
  const existingCount = await client.keyPackageStore.count();
  if (existingCount >= minCount) return;

  const needed = minCount - existingCount;
  for (let i = 0; i < needed; i++) {
    await generateAndPublishKeyPackage(client);
  }

  // Publish kind:10051 relay list event
  const pubkey = await client.signer.getPublicKey();
  const relayListEvent = createKeyPackageRelayListEvent({
    pubkey,
    relays: DEFAULT_MLS_RELAYS,
    client: 'marmota',
  });
  const signedRelayList = await client.signer.signEvent(relayListEvent);
  await client.network.publish(DEFAULT_MLS_RELAYS, signedRelayList);
}

let lastRotationTime = 0;
const ROTATION_COOLDOWN_MS = 30_000;

/**
 * Rotates key packages: generates a new one if the count drops below the threshold.
 * Should be called periodically or after a key package is consumed (via Welcome).
 * Throttled to at most once per 30s to avoid spamming relays during rapid joins.
 */
export async function rotateKeyPackagesIfNeeded(
  client: MarmotClient,
  minCount = 3,
): Promise<void> {
  if (Date.now() - lastRotationTime < ROTATION_COOLDOWN_MS) return;

  const count = await client.keyPackageStore.count();
  if (count >= minCount) return;

  const needed = minCount - count;
  for (let i = 0; i < needed; i++) {
    await generateAndPublishKeyPackage(client);
  }

  lastRotationTime = Date.now();
}
