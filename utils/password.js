import { randomInt } from 'node:crypto';

// No 0/O, 1/l/I: these passwords get read off an email and typed by hand.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';

export function generatePassword(length = 8) {
  const pick = (set) => set[randomInt(set.length)];
  // Guarantee one of each kind, fill the rest randomly, then shuffle.
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(UPPER + LOWER + DIGITS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
