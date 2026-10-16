import { HttpError } from './errors.js';
import { BOOK_LENGTHS } from '../config/settings.js';

const bad = (message) => new HttpError(400, message);

export const firstString = (value) => (Array.isArray(value) ? value[0] : value);

export function cleanName(value, field = 'full_name') {
  if (typeof value !== 'string') throw bad(`${field} is required.`);
  const v = value.trim().replace(/\s+/g, ' ');
  if (v.length < 2 || v.length > 120) throw bad(`${field} must be between 2 and 120 characters.`);
  return v;
}

export function cleanText(value, field, max = 200) {
  if (typeof value !== 'string') throw bad(`${field} is required.`);
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v || v.length > max) throw bad(`${field} is required and must be at most ${max} characters.`);
  return v;
}

export function cleanEmail(value) {
  if (typeof value !== 'string') throw bad('email is required.');
  const v = value.trim().toLowerCase();
  if (v.length > 254 || !/^[^\s@,()<>]+@[^\s@,()<>]+\.[^\s@,()<>]+$/.test(v)) {
    throw bad('Enter a valid email address.');
  }
  return v;
}

// Stored without spaces/dashes/brackets so "071 234 5678" and "0712345678" match each other.
export function cleanPhone(value) {
  if (typeof value !== 'string') throw bad('phone is required.');
  const v = value.replace(/[\s\-().]/g, '');
  if (!/^\+?\d{7,15}$/.test(v)) throw bad('Enter a valid phone number (digits, optional leading +).');
  return v;
}

export function cleanLength(value) {
  if (!BOOK_LENGTHS.includes(value)) throw bad(`length must be one of: ${BOOK_LENGTHS.join(', ')}.`);
  return value;
}

export function toId(value, field = 'id') {
  if (typeof value !== 'number' && typeof value !== 'string') throw bad(`${field} must be a positive whole number.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw bad(`${field} must be a positive whole number.`);
  return n;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function toUuid(value, field = 'id') {
  if (typeof value !== 'string' || !UUID.test(value)) throw bad(`${field} is not a valid id.`);
  return value;
}

export function toBool(value, field) {
  if (typeof value !== 'boolean') throw bad(`${field} must be true or false.`);
  return value;
}

export function pagination(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const limit = Math.min(Math.max(parseInt(firstString(query.limit), 10) || defaultLimit, 1), maxLimit);
  const offset = Math.max(parseInt(firstString(query.offset), 10) || 0, 0);
  return { limit, offset };
}

// Makes free-text safe to drop into a PostgREST .or(...) / ilike filter string.
export const safeLike = (text) => String(text).replace(/[,()%*\\_"']/g, ' ').trim();
