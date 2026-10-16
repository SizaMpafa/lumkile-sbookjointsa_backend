import { supabaseAdmin as db } from '../config/supabase.js';
import { unwrap, unwrapWithCount } from '../utils/errors.js';

// loan_requests points at users twice (requested_by, decided_by), so each embed names its column.
const SELECT = `
  id, book_id, requested_by, requested_at, decision, decided_by, decided_at, due_date, returned_at,
  book:books(id, title, author, length, status),
  requester:users!requested_by(id, full_name, phone, email),
  decider:users!decided_by(id, full_name)
`;

export const STATUS_FILTERS = ['all', 'pending', 'approved', 'declined', 'active', 'returned', 'overdue', 'open'];

export const create = async ({ book_id, requested_by }) =>
  unwrap(await db.from('loan_requests').insert({ book_id, requested_by }).select(SELECT).single());

export const getById = async (id) =>
  unwrap(await db.from('loan_requests').select(SELECT).eq('id', id).maybeSingle());

export const remove = async (id) => {
  unwrap(await db.from('loan_requests').delete().eq('id', id));
};

// status: pending | approved | declined | active (approved, not yet returned) | returned |
//         overdue (active and past due_date) | open (pending + active) | all
export async function list({ status = 'all', requested_by, today, limit = 50, offset = 0 } = {}) {
  let q = db.from('loan_requests').select(SELECT, { count: 'exact' });
  if (requested_by) q = q.eq('requested_by', requested_by);

  switch (status) {
    case 'pending': q = q.eq('decision', 'pending'); break;
    case 'approved': q = q.eq('decision', 'approved'); break;
    case 'declined': q = q.eq('decision', 'declined'); break;
    case 'active': q = q.eq('decision', 'approved').is('returned_at', null); break;
    case 'returned': q = q.not('returned_at', 'is', null); break;
    case 'overdue': q = q.eq('decision', 'approved').is('returned_at', null).lt('due_date', today); break;
    case 'open': q = q.or('decision.eq.pending,and(decision.eq.approved,returned_at.is.null)'); break;
    default: break;
  }

  q = status === 'active' || status === 'overdue'
    ? q.order('due_date', { ascending: true })
    : q.order('requested_at', { ascending: false });

  return unwrapWithCount(await q.range(offset, offset + limit - 1));
}

// Only succeeds while the request is still 'pending' (returns null if someone already decided it),
// so two staff clicking Approve/Decline at once can't both win.
export async function decide(id, { decision, decided_by, due_date = null }) {
  return unwrap(
    await db
      .from('loan_requests')
      .update({ decision, decided_by, decided_at: new Date().toISOString(), due_date })
      .eq('id', id)
      .eq('decision', 'pending')
      .select(SELECT)
      .maybeSingle(),
  );
}

export async function markReturned(id) {
  return unwrap(
    await db
      .from('loan_requests')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', id)
      .eq('decision', 'approved')
      .is('returned_at', null)
      .select(SELECT)
      .maybeSingle(),
  );
}
