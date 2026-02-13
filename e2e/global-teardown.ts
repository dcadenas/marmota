import { execSync } from 'node:child_process';

const CONTAINER_NAME = 'marmota-e2e-relay';

export default async function globalTeardown() {
  // Only stop the container if it's ours (don't kill shared relays)
  try {
    const output = execSync(`docker ps --filter "name=${CONTAINER_NAME}" -q`, {
      encoding: 'utf-8',
    }).trim();
    if (output) {
      execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'inherit' });
    }
  } catch {
    // Container already stopped or removed — fine
  }
}
