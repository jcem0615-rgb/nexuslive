/** Display helpers. No economy numbers live here — those are in economy.ts. */

export function compact(value: number): string {
  if (Math.abs(value) < 1_000) return String(value);
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function thousands(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

export function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${thousands(value)}`;
}

const RELATIVE_STEPS: [limit: number, divisor: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 1, 'second'],
  [3_600, 60, 'minute'],
  [86_400, 3_600, 'hour'],
  [604_800, 86_400, 'day'],
  [2_592_000, 604_800, 'week'],
  [31_536_000, 2_592_000, 'month'],
];

export function timeAgo(date: Date | string): string {
  const then = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.round((then.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (abs < 45) return 'just now';
  for (const [limit, divisor, unit] of RELATIVE_STEPS) {
    if (abs < limit) return formatter.format(Math.round(seconds / divisor), unit);
  }
  return formatter.format(Math.round(seconds / 31_536_000), 'year');
}

export function duration(from: Date | string): string {
  const start = typeof from === 'string' ? new Date(from) : from;
  const minutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Ledger kinds read better as sentences than as SCREAMING_SNAKE. */
const LEDGER_LABELS: Record<string, string> = {
  SIGNUP_BONUS: 'Welcome bonus',
  DAILY_BONUS: 'Daily check-in',
  PURCHASE: 'Diamond top-up',
  GIFT_SENT: 'Gift sent',
  GIFT_RECEIVED: 'Gift received',
  GAME_WAGER: 'Game round',
  GAME_WIN: 'Game win',
  CLAN_CREATE_FEE: 'Clan founded',
  CASHOUT_HOLD: 'Cash-out requested',
  CASHOUT_REFUND: 'Cash-out refunded',
  ADMIN_CREDIT: 'Adjustment (credit)',
  ADMIN_DEBIT: 'Adjustment (debit)',
};

export function ledgerLabel(kind: string): string {
  return LEDGER_LABELS[kind] ?? kind.replace(/_/g, ' ').toLowerCase();
}

export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
