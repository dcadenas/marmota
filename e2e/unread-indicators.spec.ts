import { test, expect } from '@playwright/test';
import { generateUser, loginWithNsec, sendMessage } from './helpers';

test.describe('Unread indicators', () => {
  test('unread dot appears on receive and disappears on read', async ({
    browser,
  }) => {
    const userA = generateUser();
    const userB = generateUser();

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Login both users
      await Promise.all([
        loginWithNsec(pageA, userA.nsec),
        loginWithNsec(pageB, userB.nsec),
      ]);

      // Wait for KeyPackages to be published
      await pageB.waitForTimeout(3_000);

      // User A creates group and invites User B
      await pageA.getByTestId('new-group-button').click();
      await pageA.getByTestId('group-name-input').fill('Unread Test');
      await pageA.getByTestId('create-group-submit').click();
      await pageA
        .getByTestId('group-list')
        .getByText('Unread Test')
        .waitFor({ timeout: 15_000 });

      await pageA.getByTestId('group-list').getByText('Unread Test').click();
      await pageA.getByTestId('group-settings-button').click();
      const inviteInput = pageA.locator('input[placeholder="npub or hex pubkey"]');
      await inviteInput.fill(userB.npub);
      await inviteInput.press('Enter');
      await pageA.waitForTimeout(5_000);

      // User B should see the group appear
      await expect(pageB.getByTestId('group-list')).toContainText('Unread Test', {
        timeout: 30_000,
      });

      // Wait for User B's group subscription to be established
      await pageB.waitForTimeout(2_000);

      // User A sends a message
      const message = `Unread test ${Date.now()}`;
      await sendMessage(pageA, message);

      // Wait for the message to arrive and trigger unread state
      const groupItem = pageB
        .getByTestId('group-list')
        .locator('[data-testid^="group-"]')
        .first();

      // Unread dot should appear when message arrives
      await expect(groupItem.getByTestId('unread-dot')).toBeVisible({
        timeout: 30_000,
      });

      // User B clicks into the group — sees the message and unread dot disappears
      await groupItem.click();
      await expect(pageB.getByTestId('message-list')).toContainText(message, {
        timeout: 15_000,
      });
      await expect(groupItem.getByTestId('unread-dot')).not.toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
