import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NIP44Signer } from '@/lib/signer/types';
import type { StoredSession } from '@/lib/session/session-storage';
import {
  saveSession,
  loadSession,
  clearSession,
  clearAuthorizationHandle,
} from '@/lib/session/session-storage';
import { restoreSession } from '@/lib/session/restore-session';
import { setPoolAuth, clearPoolAuth } from '@/lib/relay/pool';
import { signerToEventSigner } from '@/lib/signer/event-signer-adapter';
import { db } from '@/lib/storage/database';
import { SimplePoolNetworkInterface, createMarmotClient, createInviteReader, ensureKeyPackagePublished } from '@/lib/marmot';
import type { MarmotClient, InviteReader } from 'marmot-ts';

interface AuthState {
  signer: NIP44Signer | null;
  pubkey: string | null;
  marmotClient: MarmotClient | null;
  inviteReader: InviteReader | null;
}

interface AuthContextValue {
  signer: NIP44Signer | null;
  pubkey: string | null;
  marmotClient: MarmotClient | null;
  inviteReader: InviteReader | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  restoreError: string | null;
  login: (signer: NIP44Signer, session?: StoredSession) => Promise<void>;
  logout: () => void;
  retryRestore: () => void;
  dismissRestoreError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const network = new SimplePoolNetworkInterface();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    signer: null,
    pubkey: null,
    marmotClient: null,
    inviteReader: null,
  });
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const queryClient = useQueryClient();

  const login = useCallback(async (signer: NIP44Signer, session?: StoredSession) => {
    const pubkey = await signer.getPublicKey();

    const lastPubkey = localStorage.getItem('marmota:lastPubkey');
    if (lastPubkey && lastPubkey !== pubkey) {
      queryClient.clear();
      await Promise.all([
        db.messages.clear(),
        db.groups.clear(),
        db.groupStates.clear(),
        db.keyPackages.clear(),
        db.inviteReceived.clear(),
        db.inviteUnread.clear(),
        db.inviteSeen.clear(),
        db.syncMeta.clear(),
        db.readState.clear(),
        db.profiles.clear(),
      ]);
    }
    localStorage.setItem('marmota:lastPubkey', pubkey);

    if (session) {
      saveSession(session);
    }
    setPoolAuth(signer);

    const eventSigner = signerToEventSigner(signer);
    const marmotClient = createMarmotClient(eventSigner, network);
    const inviteReader = createInviteReader(eventSigner);

    setState({ signer, pubkey, marmotClient, inviteReader });

    // Ensure key packages are published (fire-and-forget)
    ensureKeyPackagePublished(marmotClient).catch((err) => {
      console.error('Failed to publish key packages:', err);
    });
  }, []);

  const logout = useCallback(() => {
    setState({ signer: null, pubkey: null, marmotClient: null, inviteReader: null });
    clearSession();
    clearAuthorizationHandle();
    clearPoolAuth();
    queryClient.clear();
    // Clear session-bound tables but preserve readState and profiles.
    // Keep marmota:lastPubkey so the next login detects a user switch.
    void Promise.all([
      db.messages.clear(),
      db.groups.clear(),
      db.groupStates.clear(),
      db.keyPackages.clear(),
      db.inviteReceived.clear(),
      db.inviteUnread.clear(),
      db.inviteSeen.clear(),
      db.syncMeta.clear(),
    ]);
  }, [queryClient]);

  const doRestore = useCallback(async () => {
    try {
      setIsRestoring(true);
      setRestoreError(null);
      const stored = loadSession();
      if (!stored) return;

      const signer = await Promise.race([
        restoreSession(stored).then(async (s) => {
          await s.getPublicKey(); // validate the session is still good
          return s;
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session restore timed out')), 10_000),
        ),
      ]);
      await login(signer, stored);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Session restore failed';
      setRestoreError(message);
      clearSession();
    } finally {
      setIsRestoring(false);
    }
  }, [login]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    doRestore();
  }, [doRestore]);

  const retryRestore = useCallback(() => {
    restoredRef.current = false;
    doRestore();
  }, [doRestore]);

  const dismissRestoreError = useCallback(() => {
    setRestoreError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      signer: state.signer,
      pubkey: state.pubkey,
      marmotClient: state.marmotClient,
      inviteReader: state.inviteReader,
      isAuthenticated: state.signer !== null,
      isRestoring,
      restoreError,
      login,
      logout,
      retryRestore,
      dismissRestoreError,
    }),
    [state, isRestoring, restoreError, login, logout, retryRestore, dismissRestoreError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
