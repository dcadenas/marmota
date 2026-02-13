import { test, expect } from '@playwright/test';
import { generateUser, loginWithNsec, createGroup } from './helpers';

test.describe('Group creation', () => {
  test('create a group and verify it appears in sidebar', async ({ page }) => {
    const user = generateUser();
    await loginWithNsec(page, user.nsec);

    await createGroup(page, 'Test Group');

    await expect(page.getByTestId('group-list')).toContainText('Test Group');
  });

  test('create group and send a message', async ({ page }) => {
    const user = generateUser();
    await loginWithNsec(page, user.nsec);

    await createGroup(page, 'My Chat');

    // Click the group to open it
    await page.getByTestId('group-list').getByText('My Chat').click();

    // Send a message
    await page.getByTestId('compose-input').fill('Hello from Marmota!');
    await page.getByTestId('send-button').click();

    // Message appears in the message list
    await expect(page.getByTestId('message-list')).toContainText('Hello from Marmota!');
  });
});
