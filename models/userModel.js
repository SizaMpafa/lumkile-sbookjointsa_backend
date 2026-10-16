import { supabaseAdmin as db } from '../config/supabase.js';
import { unwrap, unwrapWithCount } from '../utils/errors.js';
import { safeLike } from '../utils/validate.js';

const COLS = 'id, person_id, role, full_name, phone, email, created_at';

export const getById = async (id) =>
  unwrap(await db.from('users').select(COLS).eq('id', id).maybeSingle());

export const getByEmail = async (email) =>
  unwrap(await db.from('users').select(COLS).eq('email', email).maybeSingle());

export const getByPersonId = async (personId) =>
  unwrap(await db.from('users').select(COLS).eq('person_id', personId).maybeSingle());

export async function getByPersonIds(personIds) {
  if (!personIds.length) return [];
  return unwrap(await db.from('users').select('id, person_id').in('person_id', personIds));
}

export const create = async (row) =>
  unwrap(await db.from('users').insert(row).select(COLS).single());

export const update = async (id, fields) =>
  unwrap(await db.from('users').update(fields).eq('id', id).select(COLS).maybeSingle());

export const remove = async (id) => {
  unwrap(await db.from('users').delete().eq('id', id));
};

export async function list({ role, q, limit, offset }) {
  let query = db.from('users').select(COLS, { count: 'exact' });
  if (role) query = query.eq('role', role);
  if (q) {
    const term = safeLike(q);
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  return unwrapWithCount(await query.order('full_name').range(offset, offset + limit - 1));
}
