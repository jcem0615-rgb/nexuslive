/**
 * Phone normalisation, so "one number, one account" is enforced on the number
 * itself rather than on how somebody happened to type it.
 *
 * Deliberately conservative: E.164 only, no country guessing. A real
 * deployment should swap this for libphonenumber-js and, more importantly,
 * actually verify the number by SMS — a uniqueness constraint alone proves a
 * number was typed, not that it belongs to the person typing it.
 */
import { AppError } from './http';

/** Digits only, 8–15 of them, after a mandatory country code. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Strips spaces, dashes, brackets and dots, then insists on E.164.
 * `0917 123 4567` without a country code is rejected rather than guessed at.
 */
export function normalisePhone(input: string): string {
  const stripped = input.replace(/[\s\-().]/g, '');
  const candidate = stripped.startsWith('00') ? `+${stripped.slice(2)}` : stripped;

  if (!candidate.startsWith('+')) {
    throw AppError.badRequest('Include the country code, like +639171234567');
  }
  if (!E164.test(candidate)) {
    throw AppError.badRequest('That does not look like a valid phone number');
  }
  return candidate;
}

/** Never show a number in full to anyone but its owner. */
export function maskPhone(phone: string): string {
  if (phone.length <= 5) return phone;
  return `${phone.slice(0, 3)}${'•'.repeat(phone.length - 5)}${phone.slice(-2)}`;
}
