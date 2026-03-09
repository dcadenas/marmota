import { useState, useEffect, useCallback, useRef } from 'react';

const STALE_THRESHOLD_MS = 30_000;

export interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnect: () => void;
}

export function useConnectionStatus(onReconnect?: () => void): ConnectionStatus {
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const onReconnectRef = useRef(onReconnect);
  const hiddenAtRef = useRef<number | null>(null);
  onReconnectRef.current = onReconnect;

  const doReconnect = useCallback(() => {
    setIsReconnecting(true);
    onReconnectRef.current?.();
    setIsConnected(true);
    setIsReconnecting(false);
  }, []);

  useEffect(() => {
    const handleOffline = () => setIsConnected(false);

    const handleOnline = () => doReconnect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt && Date.now() - hiddenAt >= STALE_THRESHOLD_MS) {
        console.debug(
          `[connection] tab hidden for ${Math.round((Date.now() - hiddenAt) / 1000)}s, forcing reconnect`
        );
        doReconnect();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [doReconnect]);

  return { isConnected, isReconnecting, reconnect: doReconnect };
}
