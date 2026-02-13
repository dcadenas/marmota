import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { useRelayPool } from '@/hooks/use-relay-pool';
import { DEFAULT_METADATA_RELAYS } from '@/lib/relay/defaults';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { profileStore } from '@/lib/storage/singleton';
import type { NostrProfile } from '@/hooks/use-profile';

type ProfileUpdate = Partial<NostrProfile>;

export function useUpdateProfile() {
  const { signer, pubkey } = useAuth();
  const pool = useRelayPool();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      if (!signer || !pubkey) throw new Error('Not authenticated');

      // Fetch current profile from relays to merge with existing fields
      const existing = await pool.get(DEFAULT_METADATA_RELAYS, {
        kinds: [0],
        authors: [pubkey],
      });

      let currentProfile: Record<string, unknown> = {};
      if (existing) {
        try {
          currentProfile = JSON.parse(existing.content);
        } catch {
          // ignore malformed existing profile
        }
      }

      // Merge: keep existing fields, override with provided update
      const merged: Record<string, unknown> = { ...currentProfile };
      if (update.displayName !== undefined) merged.display_name = update.displayName;
      if (update.name !== undefined) merged.name = update.name;
      if (update.picture !== undefined) merged.picture = update.picture;
      if (update.about !== undefined) merged.about = update.about;
      if (update.nip05 !== undefined) merged.nip05 = update.nip05;

      const created_at = Math.floor(Date.now() / 1000);
      const event = await signer.signEvent({
        kind: 0,
        content: JSON.stringify(merged),
        tags: [],
        created_at,
      });

      // Publish to relays
      await Promise.allSettled(
        DEFAULT_METADATA_RELAYS.map((relay) =>
          pool.publish([relay], event),
        ),
      );

      // Update local cache
      const profile: NostrProfile = {
        name: merged.name as string | undefined,
        displayName: (merged.display_name ?? merged.displayName) as string | undefined,
        picture: merged.picture as string | undefined,
        about: merged.about as string | undefined,
        nip05: merged.nip05 as string | undefined,
      };
      await profileStore.save(pubkey, profile, created_at);

      return profile;
    },
    onSuccess: () => {
      if (pubkey) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(pubkey) });
      }
    },
  });
}
