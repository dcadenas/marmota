import { useState, useCallback } from 'react';
import { nip19 } from 'nostr-tools';
import { useCreateGroup } from '@/hooks/use-create-group';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill with a single recipient for 1:1 DM creation */
  dmRecipient?: string;
}

function truncatePubkey(hex: string): string {
  try {
    return nip19.npubEncode(hex).slice(0, 16) + '...';
  } catch {
    return hex.slice(0, 12) + '...';
  }
}

export function CreateGroupDialog({ open, onClose, dmRecipient }: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [membersInput, setMembersInput] = useState(dmRecipient ?? '');
  const [failedInvites, setFailedInvites] = useState<string[]>([]);
  const createGroup = useCreateGroup();

  const isDm = !!dmRecipient;

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setMembersInput('');
    setFailedInvites([]);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const members = membersInput
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      try {
        const result = await createGroup.mutateAsync({
          name: isDm ? '' : name,
          description: isDm ? undefined : description || undefined,
          members,
        });

        if (result.failedInvites.length > 0) {
          setFailedInvites(result.failedInvites);
          // Don't close — show the warning
        } else {
          handleClose();
        }
      } catch {
        // Error shown via createGroup.error
      }
    },
    [name, description, membersInput, isDm, createGroup, handleClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-700 shadow-xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {isDm ? 'New Direct Message' : 'Create Group'}
          </h2>

          {failedInvites.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">
                Group created, but some members couldn't be invited because they
                haven't opened Marmota yet. Ask them to sign in first, then invite
                them from the group settings.
              </p>
              <ul className="text-sm text-zinc-400 space-y-1">
                {failedInvites.map((pk) => (
                  <li key={pk} className="font-mono">{truncatePubkey(pk)}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleClose}
                className="w-full px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isDm && (
                <>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Group Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      placeholder="My Group"
                      required
                      data-testid="group-name-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      placeholder="What is this group about?"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  {isDm ? 'Recipient (npub or hex pubkey)' : 'Initial Members (one per line)'}
                </label>
                {isDm ? (
                  <input
                    type="text"
                    value={membersInput}
                    onChange={(e) => setMembersInput(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    placeholder="npub1... or hex pubkey"
                    required
                    data-testid="dm-recipient-input"
                  />
                ) : (
                  <textarea
                    value={membersInput}
                    onChange={(e) => setMembersInput(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 resize-none"
                    rows={3}
                    placeholder="npub1... or hex pubkey (one per line)"
                    data-testid="group-members-input"
                  />
                )}
              </div>

              {createGroup.error && (
                <p className="text-sm text-red-400">
                  {createGroup.error instanceof Error
                    ? createGroup.error.message
                    : 'Failed to create group'}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGroup.isPending}
                  data-testid="create-group-submit"
                  className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {createGroup.isPending ? 'Creating...' : isDm ? 'Start Chat' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
