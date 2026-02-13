import { execSync } from 'node:child_process';
import WebSocket from 'ws';

const CONTAINER_NAME = 'marmota-e2e-relay';
const PORT = 8080;
const TIMEOUT_MS = 20_000;
const RETRY_INTERVAL_MS = 500;

/**
 * Attempt a WebSocket connection and send a Nostr REQ to verify the relay
 * is fully ready (not just TCP-listening).
 */
function isRelayReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => {
      ws.terminate();
      resolve(false);
    }, 3000);

    ws.on('open', () => {
      // Send a minimal Nostr REQ — relay should respond with EOSE
      ws.send(JSON.stringify(['REQ', 'health', { kinds: [0], limit: 1 }]));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (Array.isArray(msg) && msg[0] === 'EOSE') {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        }
      } catch {
        // Not valid JSON, ignore
      }
    });

    ws.on('error', () => {
      clearTimeout(timer);
      ws.terminate();
      resolve(false);
    });
  });
}

function waitForRelay(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    async function tryConnect() {
      if (await isRelayReady(port)) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Relay not ready on port ${port} after ${timeoutMs}ms`));
      } else {
        setTimeout(tryConnect, RETRY_INTERVAL_MS);
      }
    }
    tryConnect();
  });
}

export default async function globalSetup() {
  // If a relay is already running and responding, reuse it
  if (await isRelayReady(PORT)) {
    console.log(`Relay already running on port ${PORT}, reusing it`);
    return;
  }

  // Stop any leftover container from a previous run
  try {
    execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'ignore' });
  } catch {
    // Container didn't exist — fine
  }

  execSync(
    `docker run --rm -d --name ${CONTAINER_NAME} -p ${PORT}:${PORT} ghcr.io/verse-pbc/relay_builder:latest`,
    { stdio: 'inherit' },
  );

  await waitForRelay(PORT, TIMEOUT_MS);
}
