import type { Page } from '@playwright/test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';

export interface TestUser {
  nsec: string;
  npub: string;
  pubkey: string;
}

export function generateUser(): TestUser {
  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  return {
    nsec: nip19.nsecEncode(sk),
    npub: nip19.npubEncode(pubkey),
    pubkey,
  };
}

export async function loginWithNsec(page: Page, nsec: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /nsec/i }).click();
  await page.getByTestId('nsec-input').fill(nsec);
  await page.getByTestId('login-button').click();
  // Wait for the chat view to load (account menu appears in sidebar)
  await page.getByTestId('account-menu-trigger').waitFor({ timeout: 30_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByTestId('account-menu-trigger').click();
  await page.getByTestId('account-sign-out').click();
  await page.getByTestId('divine-login-button').waitFor({ timeout: 5_000 });
}

export async function createGroup(
  page: Page,
  name: string,
): Promise<void> {
  await page.getByTestId('new-group-button').click();
  await page.getByTestId('group-name-input').fill(name);
  await page.getByTestId('create-group-submit').click();
  // Wait for dialog to close and group to appear in sidebar
  await page.getByTestId('group-list').getByText(name).waitFor({ timeout: 15_000 });
}

export async function inviteMember(
  page: Page,
  groupName: string,
  memberPubkeyOrNpub: string,
): Promise<void> {
  // Click into the group
  await page.getByTestId('group-list').getByText(groupName).click();
  // Open group settings
  await page.getByTestId('group-settings-button').click();
  // Fill invite input and submit
  const inviteInput = page.locator('input[placeholder="npub or hex pubkey"]');
  await inviteInput.fill(memberPubkeyOrNpub);
  await inviteInput.press('Enter');
  // Wait for invite to process
  await page.waitForTimeout(3_000);
}

export async function sendMessage(page: Page, message: string): Promise<void> {
  await page.getByTestId('compose-input').fill(message);
  await page.getByTestId('send-button').click();
}
