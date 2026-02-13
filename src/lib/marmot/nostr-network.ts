import type { NostrEvent } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import type { SubCloser } from 'nostr-tools/abstract-pool';
import type {
  NostrNetworkInterface,
  PublishResponse,
  Subscribable,
  Observer,
  Unsubscribable,
} from 'marmot-ts';
import { getPool } from '@/lib/relay/pool';
import { DEFAULT_MLS_RELAYS, DEFAULT_METADATA_RELAYS } from '@/lib/relay/defaults';

/** Normalize filters to an array. */
function toFilterArray(filters: Filter | Filter[]): Filter[] {
  return (Array.isArray(filters) ? filters : [filters]) as Filter[];
}

/**
 * Implements marmot-ts NostrNetworkInterface by wrapping nostr-tools SimplePool.
 */
export class SimplePoolNetworkInterface implements NostrNetworkInterface {
  async publish(
    relays: string[],
    event: NostrEvent,
  ): Promise<Record<string, PublishResponse>> {
    const pool = getPool();
    const promises = pool.publish(relays, event);
    const results: Record<string, PublishResponse> = {};

    await Promise.allSettled(
      relays.map(async (relay, i) => {
        try {
          await promises[i];
          results[relay] = { from: relay, ok: true };
        } catch (err) {
          results[relay] = { from: relay, ok: false, message: String(err) };
        }
      }),
    );

    return results;
  }

  async request(
    relays: string[],
    filters: Filter | Filter[],
  ): Promise<NostrEvent[]> {
    const pool = getPool();
    const filterArray = toFilterArray(filters);
    // querySync takes a single Filter and internally wraps it in [filter].
    // To support multiple filters, make parallel calls and merge results.
    const results = await Promise.all(
      filterArray.map((f) => pool.querySync(relays, f as Filter)),
    );
    return results.flat() as NostrEvent[];
  }

  subscription(
    relays: string[],
    filters: Filter | Filter[],
  ): Subscribable<NostrEvent> {
    const pool = getPool();
    const filterArray = toFilterArray(filters);

    return {
      subscribe(observer: Partial<Observer<NostrEvent>>): Unsubscribable {
        // pool.subscribeMany takes a single Filter, not Filter[].
        // Create one subscription per filter and combine them.
        const closers: SubCloser[] = [];
        let closedCount = 0;

        for (const filter of filterArray) {
          const sub = pool.subscribeMany(relays, filter as Filter, {
            onevent(event) {
              observer.next?.(event as NostrEvent);
            },
            onclose(reasons) {
              closedCount++;
              if (reasons.some((r) => r.includes('error'))) {
                observer.error?.(new Error(reasons.join(', ')));
              }
              if (closedCount >= filterArray.length) {
                observer.complete?.();
              }
            },
          });
          closers.push(sub);
        }

        return {
          unsubscribe() {
            closers.forEach((sub) => sub.close());
          },
        };
      },
    };
  }

  async getUserInboxRelays(pubkey: string): Promise<string[]> {
    const pool = getPool();
    const events = await pool.querySync(
      DEFAULT_METADATA_RELAYS,
      { kinds: [10051], authors: [pubkey], limit: 1 } as Filter,
    );

    if (events.length === 0) return DEFAULT_MLS_RELAYS;

    const event = events[0]!;
    const relays = event.tags
      .filter((t: string[]) => t[0] === 'relay')
      .map((t: string[]) => t[1])
      .filter(Boolean);

    return relays.length > 0 ? relays : DEFAULT_MLS_RELAYS;
  }
}
