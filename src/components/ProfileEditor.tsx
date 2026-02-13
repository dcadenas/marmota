import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { useUpdateProfile } from '@/hooks/use-update-profile';
import { ProfilePic } from '@/components/profile';

interface ProfileEditorProps {
  onClose: () => void;
}

export function ProfileEditor({ onClose }: ProfileEditorProps) {
  const { pubkey } = useAuth();
  const { data: profile } = useProfile(pubkey ?? '');
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [picture, setPicture] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? profile.name ?? '');
      setAbout(profile.about ?? '');
      setPicture(profile.picture ?? '');
    }
  }, [profile]);

  async function handleSave() {
    try {
      await updateProfile.mutateAsync({
        displayName: displayName || undefined,
        about: about || undefined,
        picture: picture || undefined,
      });
      onClose();
    } catch {
      // Error shown via updateProfile.error
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-800/60 bg-gray-900 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center">
          {picture ? (
            <img
              src={picture}
              alt="Preview"
              className="h-16 w-16 rounded-full object-cover border-2 border-gray-700"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            pubkey && <ProfilePic pubkey={pubkey} size="lg" />
          )}
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-400">Display Name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-400">About</span>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="A short bio..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white
                         resize-none focus:outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-400">Picture URL</span>
            <input
              type="url"
              value={picture}
              onChange={(e) => setPicture(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        {updateProfile.error && (
          <p className="text-xs text-red-400">
            {updateProfile.error instanceof Error ? updateProfile.error.message : 'Failed to update profile'}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white
                       transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
