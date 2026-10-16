// "Visitors" = the `people` table: everyone who has physically visited, with or without a login.
import { supabaseAdmin as db } from '../config/supabase.js';
import { unwrap, unwrapWithCount } from '../utils/errors.js';
import { safeLike } from '../utils/validate.js';

const COLS = 'id, full_name, phone, email, created_at';

export const create = async (row) =>
  unwrap(await db.from('people').insert(row).select(COLS).single());

export const getById = async (id) =>
  unwrap(await db.from('people').select(COLS).eq('id', id).maybeSingle());

export const update = async (id, fields) =>
  unwrap(await db.from('people').update(fields).eq('id', id).select(COLS).maybeSingle());

export const remove = async (id) => {
  unwrap(await db.from('people').delete().eq('id', id));
};

// Anyone already on file with the same phone OR email (families do share these, so this is a
// warning for staff to judge, never a hard block).
export async function findDuplicates({ phone, email }) {
  const [byPhone, byEmail] = await Promise.all([
    db.from('people').select(COLS).eq('phone', phone),
    db.from('people').select(COLS).eq('email', email),
  ]);
  const rows = [...unwrap(byPhone), ...unwrap(byEmail)];
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}

export async function search(q, limit = 20) {
  const term = safeLike(q);
  const phoneTerm = term.replace(/[\s\-.]/g, ''); // phones are stored without spaces
  const filters = [`full_name.ilike.%${term}%`, `email.ilike.%${term}%`];
  if (phoneTerm) filters.push(`phone.ilike.%${phoneTerm}%`);
  return unwrap(await db.from('people').select(COLS).or(filters.join(',')).order('full_name').limit(limit));
}

export async function list({ limit, offset }) {
  return unwrapWithCount(
    await db.from('people').select(COLS, { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
  );
}
