import { supabaseAdmin as db } from '../config/supabase.js';
import { HttpError, fromDbError, unwrap, unwrapWithCount } from '../utils/errors.js';
import { safeLike } from '../utils/validate.js';

const COLS = 'id, title, author, length, is_lendable, status, created_at';
const STATUSES = ['available', 'requested', 'on_loan'];

export const getById = async (id) =>
  unwrap(await db.from('books').select(COLS).eq('id', id).maybeSingle());

// status only has a value while a book is in the lending pool: 'available' the moment it enters,
// null when it is library-only.
export const create = async ({ title, author, length, is_lendable }) =>
  unwrap(await db.from('books').insert({ title, author, length, is_lendable, status: is_lendable ? 'available' : null }).select(COLS).single());

export const update = async (id, fields) =>
  unwrap(await db.from('books').update(fields).eq('id', id).select(COLS).maybeSingle());

export async function remove(id) {
  const { error } = await db.from('books').delete().eq('id', id);
  if (error?.code === '23503') {
    throw new HttpError(409, 'This book has loan history, so it cannot be deleted. Take it out of lending instead.');
  }
  if (error) throw fromDbError(error);
}

// filters: any of 'available' | 'requested' | 'on_loan' | 'library_only' (or 'all'), combined with OR
export async function list({ filters = [], q, limit, offset }) {
  let query = db.from('books').select(COLS, { count: 'exact' });
  const wanted = filters.filter((f) => f !== 'all');
  if (wanted.length) {
    const ors = [];
    const statuses = wanted.filter((f) => STATUSES.includes(f));
    if (statuses.length) ors.push(`status.in.(${statuses.join(',')})`);
    if (wanted.includes('library_only')) ors.push('is_lendable.eq.false');
    if (ors.length) query = query.or(ors.join(','));
  }
  if (q) {
    const term = safeLike(q);
    query = query.or(`title.ilike.%${term}%,author.ilike.%${term}%`);
  }
  return unwrapWithCount(await query.order('title').range(offset, offset + limit - 1));
}

// Put a book in / take it out of the lending pool.
export async function setLendable(id, wanted) {
  const book = await getById(id);
  if (!book) throw new HttpError(404, 'Book not found.');
  if (book.is_lendable === wanted) return book;

  if (wanted) {
    const updated = unwrap(
      await db.from('books').update({ is_lendable: true, status: 'available' }).eq('id', id).eq('is_lendable', false).select(COLS).maybeSingle(),
    );
    return updated ?? (await getById(id));
  }

  if (book.status !== 'available') {
    throw new HttpError(409, 'This book is requested or out on loan. Wait until it is back before removing it from lending.');
  }
  // conditional on status = 'available' so a request that lands a millisecond earlier wins
  const updated = unwrap(
    await db.from('books').update({ is_lendable: false, status: null }).eq('id', id).eq('status', 'available').select(COLS).maybeSingle(),
  );
  if (!updated) throw new HttpError(409, 'Someone just requested this book, so it cannot be removed from lending right now.');
  return updated;
}

// Atomically move a lendable book from `from` to `to`. Returns null if it wasn't in `from`
// (someone else got there first). Because the check and the write are ONE statement, two
// customers can never both claim the same copy.
export async function transition(id, from, to) {
  return unwrap(
    await db.from('books').update({ status: to }).eq('id', id).eq('is_lendable', true).eq('status', from).select(COLS).maybeSingle(),
  );
}

export const claimAvailable = (id) => transition(id, 'available', 'requested');

export async function stats() {
  const count = async (build) => {
    const { count: n, error } = await build(db.from('books').select('id', { count: 'exact', head: true }));
    if (error) throw fromDbError(error);
    return n ?? 0;
  };
  const [total, lendable, available, requested, on_loan] = await Promise.all([
    count((q) => q),
    count((q) => q.eq('is_lendable', true)),
    count((q) => q.eq('status', 'available')),
    count((q) => q.eq('status', 'requested')),
    count((q) => q.eq('status', 'on_loan')),
  ]);
  return { total, lendable, library_only: total - lendable, available, requested, on_loan };
}
