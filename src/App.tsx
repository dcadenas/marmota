import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { LoginScreen } from '@/components/LoginScreen';
import { AuthCallback } from '@/components/AuthCallback';
import { ChatView } from '@/components/ChatView';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 1,
    },
  },
});

function RestoreErrorBanner() {
  const { restoreError, retryRestore, dismissRestoreError } = useAuth();
  if (!restoreError) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-red-950/60 border-b border-red-900/40 px-4 py-2.5">
      <p className="text-xs text-red-300">Session expired. Please sign in again.</p>
      <div className="flex items-center gap-2">
        <button
          onClick={retryRestore}
          className="text-xs text-red-300 underline hover:text-red-200 transition-colors"
        >
          Retry
        </button>
        <button
          onClick={dismissRestoreError}
          className="text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isRestoring } = useAuth();

  // Handle OAuth callback
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (isRestoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
        <div className="text-center">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500" />
          <p className="mt-3 text-sm text-gray-400">Reconnecting to your signer...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <RestoreErrorBanner />
        <LoginScreen />
      </>
    );
  }

  return (
    <ErrorBoundary>
      <ChatView />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
