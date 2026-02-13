import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import type { StoredGroup } from '@/lib/storage/database';
import type { NostrProfile } from './use-profile';

function truncatePubkey(pubkey: string): string {
  return pubkey.slice(0, 8) + '...';
}

function truncateBody(content: string, max = 100): string {
  if (content.length <= max) return content;
  return content.slice(0, max) + '...';
}

export function useWebNotifications(): void {
  const queryClient = useQueryClient();
  const { pubkey } = useAuth();
  const prevGroupsRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!pubkey) return;
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (event.action.type !== 'success') return;

      const queryKey = event.query.queryKey;
      if (
        queryKey.length !== QUERY_KEYS.groups.length ||
        queryKey[0] !== QUERY_KEYS.groups[0]
      ) {
        return;
      }

      if (Notification.permission !== 'granted') return;

      const groups = event.query.state.data as StoredGroup[] | undefined;
      if (!groups) return;

      const prev = prevGroupsRef.current;
      const next = new Map<string, string>();
      for (const group of groups) {
        if (group.lastMessage) {
          next.set(group.id, group.lastMessage.id);
        }
      }

      // First render — snapshot only, no notifications
      if (prev === null) {
        prevGroupsRef.current = next;
        return;
      }

      for (const group of groups) {
        if (!group.lastMessage) continue;
        const prevMessageId = prev.get(group.id);
        if (prevMessageId === group.lastMessage.id) continue;

        if (group.lastMessage.senderPubkey === pubkey) continue;
        if (!document.hidden) continue;

        const senderPubkey = group.lastMessage.senderPubkey;
        const profile = queryClient.getQueryData<NostrProfile | null>(
          QUERY_KEYS.profile(senderPubkey),
        );

        const senderName =
          profile?.displayName || profile?.name || truncatePubkey(senderPubkey);
        const title = group.name ? `${senderName} in ${group.name}` : senderName;
        const body = truncateBody(group.lastMessage.content);
        const icon = profile?.picture;

        const notification = new Notification(title, {
          body,
          icon,
          tag: group.id,
        });

        notification.onclick = () => {
          window.focus();
        };
      }

      prevGroupsRef.current = next;
    });

    return unsubscribe;
  }, [pubkey, queryClient]);
}
