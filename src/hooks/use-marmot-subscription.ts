import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { DEFAULT_MLS_RELAYS } from '@/lib/relay/defaults';
import { processGroupEvents } from '@/lib/marmot/message-processor';
import { rotateKeyPackagesIfNeeded } from '@/lib/marmot/key-package-publisher';
import { db } from '@/lib/storage/database';
import type { NostrEvent } from 'nostr-tools/pure';
import type { Unsubscribable, MarmotGroup } from 'marmot-ts';

const BACKFILL_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEDUP_SET_MAX_SIZE = 1000;

/**
 * Central subscription orchestrator for the Marmot protocol.
 *
 * Handles:
 * 1. Subscribe to kind:1059 gift wraps → InviteReader → auto-join groups
 * 2. Subscribe to kind:445 per group → group.ingest() → messages
 * 3. Watch for new groups and start subscriptions
 * 4. Backfill: on login, fetch historical kind:445 events since last known timestamp
 * 5. Key package rotation: on join, consumed key packages are handled by marmot-ts
 * 6. Reconnection: tear down and re-establish all subscriptions on network recovery
 * 7. Post-join self-update: attempt epoch advance after joining via Welcome
 */
export function useMarmotSubscription() {
  const { marmotClient, inviteReader, pubkey } = useAuth();
  const queryClient = useQueryClient();
  const subsRef = useRef<Unsubscribable[]>([]);
  const groupSubsRef = useRef<Map<string, Unsubscribable>>(new Map());
  const seenEventsRef = useRef<Set<string>>(new Set());
  const reconnectRef = useRef<(() => void) | null>(null);

  const reconnect = useCallback(() => {
    reconnectRef.current?.();
  }, []);

  useEffect(() => {
    if (!marmotClient || !inviteReader || !pubkey) return;

    const seenEvents = seenEventsRef.current;

    function addToDedup(eventId: string) {
      seenEvents.add(eventId);
      // Evict oldest entries when set grows too large
      if (seenEvents.size > DEDUP_SET_MAX_SIZE) {
        const iter = seenEvents.values();
        const toRemove = seenEvents.size - DEDUP_SET_MAX_SIZE;
        for (let i = 0; i < toRemove; i++) {
          seenEvents.delete(iter.next().value!);
        }
      }
    }

    function isDuplicate(eventId: string): boolean {
      return seenEvents.has(eventId);
    }

    function teardownAll() {
      for (const sub of subsRef.current) sub.unsubscribe();
      subsRef.current = [];
      for (const sub of groupSubsRef.current.values()) sub.unsubscribe();
      groupSubsRef.current.clear();
    }

    // 1. Subscribe to kind:1059 gift wraps for Welcome messages
    function subscribeGiftWraps(): Unsubscribable {
      return marmotClient!.network
        .subscription(DEFAULT_MLS_RELAYS, [
          { kinds: [1059], '#p': [pubkey!] },
        ])
        .subscribe({
          next: (event: NostrEvent) => {
            inviteReader!.ingestEvent(event).catch(console.error);
          },
        });
    }

    // Process ingested gift wraps: decrypt → join group
    async function processInvites() {
      const unread = await inviteReader!.decryptGiftWraps();
      for (const invite of unread) {
        try {
          const group = await marmotClient!.joinGroupFromWelcome({
            welcomeRumor: invite,
          });

          // MIP-02 post-join self-update: empty commit advances the epoch,
          // rotating leaf node keys away from the published KeyPackage credentials.
          // Required by the Marmot spec for forward secrecy (within 24h, ideally immediate).
          // Currently only succeeds for admins — marmot-ts blocks non-admin commits
          // even though the spec (MIP-03 / marmot-protocol PR #23) allows non-admin
          // self-update commits. Once marmot-ts implements that, this will work for all.
          try {
            await group.commit({ extraProposals: [] });
          } catch {
            // Non-admin or empty commit unsupported — tracked upstream
          }

          // Persist group metadata
          const groupData = group.groupData;
          await db.groups.put({
            id: group.idStr,
            name: groupData?.name ?? '',
            description: groupData?.description,
            members: [],
            messageCount: 0,
            createdAt: Math.floor(Date.now() / 1000),
            nostrGroupId: groupData?.nostrGroupId
              ? Array.from(groupData.nostrGroupId)
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('')
              : undefined,
          });
          // Start subscription for the newly joined group
          subscribeToGroup(group).catch(console.error);
          await inviteReader!.markAsRead(invite.id);
          // A key package was consumed by the Welcome — rotate
          rotateKeyPackagesIfNeeded(marmotClient!).catch(console.error);
        } catch (err) {
          console.error('Failed to join group from invite:', err);
        }
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storedGroups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingInvites });
    }

    inviteReader.on('ReceivedGiftWrap', () => {
      processInvites().catch(console.error);
    });

    // 2. Subscribe to kind:445 per existing group (with backfill + dedup)
    async function subscribeToGroup(group: MarmotGroup) {
      if (groupSubsRef.current.has(group.idStr)) return;

      const groupData = group.groupData;
      if (!groupData) return;

      const nostrGroupId = Array.from(groupData.nostrGroupId)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const relays = groupData.relays.length > 0 ? groupData.relays : DEFAULT_MLS_RELAYS;

      // Backfill: fetch events since last sync timestamp, capped to 7 days
      const syncKey = `lastSync_${group.idStr}`;
      const syncMeta = await db.syncMeta.get(syncKey);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const minSince = nowSeconds - BACKFILL_MAX_AGE_SECONDS;
      const since = syncMeta?.value ? Math.max(syncMeta.value, minSince) : 0;

      if (since > 0) {
        try {
          const historical = await marmotClient!.network.request(relays, [
            { kinds: [445], '#h': [nostrGroupId], since },
          ]);
          // Dedup: filter out already-seen events
          const fresh = historical.filter((e) => !isDuplicate(e.id));
          for (const e of fresh) addToDedup(e.id);
          if (fresh.length > 0) {
            await processGroupEvents(group, fresh, queryClient);
          }
        } catch (err) {
          console.error(`Backfill failed for group ${group.idStr}:`, err);
        }
      }

      // Live subscription
      const eventBuffer: NostrEvent[] = [];
      let flushTimeout: ReturnType<typeof setTimeout> | null = null;

      const sub = marmotClient!.network
        .subscription(relays, [
          { kinds: [445], '#h': [nostrGroupId] },
        ])
        .subscribe({
          next: (event: NostrEvent) => {
            // Skip duplicates (overlap between backfill and live)
            if (isDuplicate(event.id)) return;
            addToDedup(event.id);

            eventBuffer.push(event);
            // Batch events before processing
            if (flushTimeout) clearTimeout(flushTimeout);
            flushTimeout = setTimeout(() => {
              const batch = eventBuffer.splice(0);
              if (batch.length > 0) {
                processGroupEvents(group, batch, queryClient).then(() => {
                  // Update sync timestamp
                  const maxTs = Math.max(...batch.map((e) => e.created_at));
                  db.syncMeta.put({ key: syncKey, value: maxTs }).catch(console.error);
                }).catch(console.error);
              }
            }, 100);
          },
        });

      groupSubsRef.current.set(group.idStr, sub);
    }

    // Setup: subscribe to everything
    function setupSubscriptions() {
      const giftWrapSub = subscribeGiftWraps();
      subsRef.current.push(giftWrapSub);

      marmotClient!.loadAllGroups().then((groups) => {
        for (const group of groups) {
          subscribeToGroup(group).catch(console.error);
        }
      }).catch(console.error);

      processInvites().catch(console.error);
    }

    // Reconnection: tear down everything and re-subscribe
    reconnectRef.current = () => {
      teardownAll();
      seenEvents.clear();
      setupSubscriptions();
    };

    // 3. Watch for new groups
    const handleNewGroup = (group: MarmotGroup) => {
      subscribeToGroup(group).catch(console.error);
    };
    marmotClient.on('groupCreated', handleNewGroup);
    marmotClient.on('groupJoined', handleNewGroup);

    setupSubscriptions();

    return () => {
      teardownAll();
      reconnectRef.current = null;
      marmotClient.off('groupCreated', handleNewGroup);
      marmotClient.off('groupJoined', handleNewGroup);
      inviteReader.removeAllListeners('ReceivedGiftWrap');
    };
  }, [marmotClient, inviteReader, pubkey, queryClient]);

  return { reconnect };
}
