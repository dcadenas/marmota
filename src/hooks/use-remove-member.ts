import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MarmotGroup } from 'marmot-ts';
import { Proposals } from 'marmot-ts';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';

interface RemoveMemberInput {
  group: MarmotGroup;
  memberPubkey: string;
}

export function useRemoveMember() {
  const { pubkey } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ group, memberPubkey }: RemoveMemberInput) => {
      if (!pubkey) throw new Error('Not authenticated');
      if (memberPubkey === pubkey) throw new Error('Cannot remove yourself. Use "Leave Group" instead.');

      // proposeKickUser returns ProposalAction<ProposalRemove[]> since a user
      // may have multiple leaf nodes. Cast needed because the generic doesn't
      // directly match the union, but commit() handles arrays at runtime.
      await group.commit({
        extraProposals: [Proposals.proposeKickUser(memberPubkey) as never],
      });
    },
    onSuccess: (_data, { group }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groupMembers(group.idStr) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
    },
  });
}
