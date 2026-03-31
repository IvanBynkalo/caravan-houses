import { randomBytes } from 'crypto';

export function nanoid(size = 12): string {
  return randomBytes(size).toString('base64url').slice(0, size);
}

export function shortId(size = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(size);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}
