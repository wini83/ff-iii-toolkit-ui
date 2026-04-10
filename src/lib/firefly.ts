import type { components } from '$lib/api/schema';

export type FireflyAccountRef = components['schemas']['SimplifiedAccountRef'];

export function formatFireflyAccount(account: FireflyAccountRef | null | undefined): string {
  if (!account) return '-';

  const name = account.name.trim() || `Account #${account.id}`;
  const meta: string[] = [];

  if (account.type) {
    meta.push(account.type);
  }

  const iban = account.iban?.trim();
  if (iban) {
    meta.push(iban);
  }

  return meta.length > 0 ? `${name} (${meta.join(' · ')})` : name;
}
