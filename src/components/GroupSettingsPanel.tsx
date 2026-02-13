import { useState } from 'react';
import { getGroupMembers } from 'marmot-ts';
import type { MarmotGroup } from 'marmot-ts';
import { useAuth } from '@/context/auth-context';
import { useInviteMember } from '@/hooks/use-invite-member';
import { useLeaveGroup } from '@/hooks/use-leave-group';
import { useRemoveMember } from '@/hooks/use-remove-member';
import { useUpdateGroup } from '@/hooks/use-update-group';
import { ProfilePic, DisplayName } from '@/components/profile';

interface GroupSettingsPanelProps {
  group: MarmotGroup;
  onClose: () => void;
  onLeft?: () => void;
}

export function GroupSettingsPanel({ group, onClose, onLeft }: GroupSettingsPanelProps) {
  const { pubkey } = useAuth();
  const [inviteInput, setInviteInput] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const inviteMember = useInviteMember();
  const leaveGroup = useLeaveGroup();
  const removeMember = useRemoveMember();
  const updateGroup = useUpdateGroup();

  const groupData = group.groupData;
  const members = getGroupMembers(group.state);
  const isAdmin = pubkey ? groupData?.adminPubkeys.includes(pubkey) ?? false : false;
  const isOnlyAdmin = isAdmin && groupData?.adminPubkeys.length === 1;

  async function handleInvite() {
    const pk = inviteInput.trim();
    if (!pk) return;

    try {
      await inviteMember.mutateAsync({ group, memberPubkey: pk });
      setInviteInput('');
    } catch {
      // Error shown via inviteMember.error
    }
  }

  async function handleLeave() {
    try {
      await leaveGroup.mutateAsync({ groupId: group.idStr });
      onLeft?.();
    } catch {
      // Error shown via leaveGroup.error
    }
  }

  async function handleRemoveMember(memberPubkey: string) {
    try {
      await removeMember.mutateAsync({ group, memberPubkey });
      setConfirmRemove(null);
    } catch {
      // Error shown via removeMember.error
    }
  }

  return (
    <div className="border-b border-gray-800/40 bg-gray-900/50 px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Group Info</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
        >
          Close
        </button>
      </div>

      {/* Group details */}
      {groupData && (
        <div className="space-y-1">
          {/* Group name */}
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white
                           focus:outline-none focus:border-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateGroup.mutate({ group, name: nameInput }, {
                      onSuccess: () => setEditingName(false),
                    });
                  } else if (e.key === 'Escape') {
                    setEditingName(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  updateGroup.mutate({ group, name: nameInput }, {
                    onSuccess: () => setEditingName(false),
                  });
                }}
                disabled={updateGroup.isPending}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                {updateGroup.isPending ? '...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="text-[10px] text-gray-500 hover:text-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/name">
              <p className="text-sm text-gray-100">{groupData.name}</p>
              {isAdmin && (
                <button
                  onClick={() => { setNameInput(groupData.name); setEditingName(true); }}
                  className="text-gray-600 opacity-0 group-hover/name:opacity-100 hover:text-gray-400 transition-all"
                  title="Edit name"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Group description */}
          {editingDesc ? (
            <div className="space-y-1">
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white
                           resize-none focus:outline-none focus:border-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingDesc(false);
                }}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    updateGroup.mutate({ group, description: descInput }, {
                      onSuccess: () => setEditingDesc(false),
                    });
                  }}
                  disabled={updateGroup.isPending}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300"
                >
                  {updateGroup.isPending ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingDesc(false)}
                  className="text-[10px] text-gray-500 hover:text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 group/desc">
              {groupData.description ? (
                <p className="text-xs text-gray-400">{groupData.description}</p>
              ) : isAdmin ? (
                <p className="text-xs text-gray-600 italic">No description</p>
              ) : null}
              {isAdmin && (
                <button
                  onClick={() => { setDescInput(groupData.description ?? ''); setEditingDesc(true); }}
                  className="text-gray-600 opacity-0 group-hover/desc:opacity-100 hover:text-gray-400 transition-all mt-0.5 shrink-0"
                  title="Edit description"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {updateGroup.error && (
            <p className="text-[10px] text-red-400">
              {updateGroup.error instanceof Error ? updateGroup.error.message : 'Failed to update group'}
            </p>
          )}
        </div>
      )}

      {/* Members */}
      <div>
        <p className="text-xs text-gray-500 mb-2">
          Members ({members.length})
        </p>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {members.map((mk) => (
            <div key={mk} className="flex items-center gap-2">
              <ProfilePic pubkey={mk} size="sm" />
              <span className="text-xs text-gray-300 truncate flex-1">
                <DisplayName pubkey={mk} />
              </span>
              {groupData?.adminPubkeys.includes(mk) && (
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  admin
                </span>
              )}
              {isAdmin && mk !== pubkey && (
                <>
                  {confirmRemove === mk ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRemoveMember(mk)}
                        disabled={removeMember.isPending}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        {removeMember.isPending ? '...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="text-[10px] text-gray-500 hover:text-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(mk)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Remove member"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {removeMember.error && (
          <p className="mt-1 text-[10px] text-red-400">
            {removeMember.error instanceof Error ? removeMember.error.message : 'Failed to remove member'}
          </p>
        )}
      </div>

      {/* Invite member */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Invite Member</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="npub or hex pubkey"
            className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white
                       focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          <button
            onClick={handleInvite}
            disabled={inviteMember.isPending || !inviteInput.trim()}
            className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg
                       transition-colors disabled:opacity-50"
          >
            {inviteMember.isPending ? '...' : 'Invite'}
          </button>
        </div>
        {inviteMember.error && (
          <p className="mt-1 text-[10px] text-red-400">
            {inviteMember.error instanceof Error
              ? inviteMember.error.message
              : 'Failed to invite'}
          </p>
        )}
      </div>

      {/* Leave group */}
      <div className="pt-2 border-t border-gray-800/40">
        {confirmLeave ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">
              Leave {groupData?.name ?? 'this group'}? You won't be able to rejoin unless re-invited.
            </p>
            {isOnlyAdmin && (
              <p className="text-xs text-amber-400">
                You are the only admin. Leaving will make this group unmanageable.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleLeave}
                disabled={leaveGroup.isPending}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg
                           transition-colors disabled:opacity-50"
              >
                {leaveGroup.isPending ? 'Leaving...' : 'Leave'}
              </button>
              <button
                onClick={() => setConfirmLeave(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
            {leaveGroup.error && (
              <p className="text-[10px] text-red-400">
                {leaveGroup.error instanceof Error ? leaveGroup.error.message : 'Failed to leave group'}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setConfirmLeave(true)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Leave Group
          </button>
        )}
      </div>
    </div>
  );
}
