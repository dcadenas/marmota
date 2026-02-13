import { test, expect } from '@playwright/test';
import { generateUser, loginWithNsec, sendMessage } from './helpers';

test.describe('Two-user MLS messaging', () => {
  test('full Marmot flow: create group, invite, bidirectional messages', async ({
    browser,
  }) => {
    const userA = generateUser();
    const userB = generateUser();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Capture console logs for debugging
    const logsA: string[] = [];
    const logsB: string[] = [];
    pageA.on('console', (msg) => logsA.push(`[A][${msg.type()}] ${msg.text()}`));
    pageB.on('console', (msg) => logsB.push(`[B][${msg.type()}] ${msg.text()}`));

    try {
      // Login both users (publishes KeyPackages to local relay)
      await Promise.all([
        loginWithNsec(pageA, userA.nsec),
        loginWithNsec(pageB, userB.nsec),
      ]);

      // Wait for User B's KeyPackage to be published to the relay
      await pageB.waitForTimeout(3_000);

      // User A creates a group
      await pageA.getByTestId('new-group-button').click();
      await pageA.getByTestId('group-name-input').fill('E2E Test Group');
      await pageA.getByTestId('create-group-submit').click();
      await pageA
        .getByTestId('group-list')
        .getByText('E2E Test Group')
        .waitFor({ timeout: 15_000 });

      // User A opens the group
      await pageA.getByTestId('group-list').getByText('E2E Test Group').click();

      // User A invites User B via group settings
      await pageA.getByTestId('group-settings-button').click();
      const inviteInput = pageA.locator('input[placeholder="npub or hex pubkey"]');
      await inviteInput.fill(userB.npub);
      await inviteInput.press('Enter');

      // Wait for invite to be sent (Welcome → gift wrap → relay)
      await pageA.waitForTimeout(5_000);

      // User B receives the Welcome and auto-joins the group
      await expect(pageB.getByTestId('group-list')).toContainText('E2E Test Group', {
        timeout: 30_000,
      });

      // User B clicks into the group (starts group subscription for kind:445)
      await pageB.getByTestId('group-list').getByText('E2E Test Group').click();

      // Wait for User B's group subscription to be established
      await pageB.waitForTimeout(3_000);

      // User A sends a message
      const messageA = `Hello from A! ${Date.now()}`;
      console.log(`Sending message from A: ${messageA}`);
      await sendMessage(pageA, messageA);

      // Message appears for User A (optimistic)
      await expect(pageA.getByTestId('message-list')).toContainText(messageA, {
        timeout: 10_000,
      });
      console.log('Message appears for User A');

      // User B receives the message via kind:445 subscription
      await expect(pageB.getByTestId('message-list')).toContainText(messageA, {
        timeout: 30_000,
      });
      console.log('Message received by User B');

      // User B replies
      const messageB = `Hi from B! ${Date.now()}`;
      await sendMessage(pageB, messageB);

      // Reply appears for User B (optimistic)
      await expect(pageB.getByTestId('message-list')).toContainText(messageB);

      // User A receives the reply
      await expect(pageA.getByTestId('message-list')).toContainText(messageB, {
        timeout: 30_000,
      });
    } finally {
      // Print relevant logs on failure
      const relevantA = logsA.filter(
        (l) => l.includes('MarmotSub') || l.includes('MessageProcessor') || l.includes('MarmotGroup') || l.includes('[error]'),
      );
      const relevantB = logsB.filter(
        (l) => l.includes('MarmotSub') || l.includes('MessageProcessor') || l.includes('MarmotGroup') || l.includes('Welcome') || l.includes('[error]'),
      );
      if (relevantA.length) console.log('User A relevant logs:\n' + relevantA.join('\n'));
      if (relevantB.length) console.log('User B relevant logs:\n' + relevantB.join('\n'));

      await contextA.close();
      await contextB.close();
    }
  });
});
