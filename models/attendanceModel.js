import { supabaseAdmin as db } from '../config/supabase.js';
import { HttpError, fromDbError, unwrap } from '../utils/errors.js';

const COLS = 'id, person_id, visited_at, recorded_by';

export async function record({ person_id, visited_at, recorded_by }) {
  const { data, error } = await db.from('attendances').insert({ person_id, visited_at, recorded_by }).select(COLS).single();
  // unique (person_id, visited_at) in the database is what guarantees one visit per person per day
  if (error?.code === '23505') throw new HttpError(409, 'Attendance is already recorded for this person for that day.');
  if (error) throw fromDbError(error);
  return data;
}

export async function countByPerson(personId) {
  const { count, error } = await db.from('attendances').select('id', { count: 'exact', head: true }).eq('person_id', personId);
  if (error) throw fromDbError(error);
  return count ?? 0;
}

// Visit counts for many people at once. Pages through results because Supabase caps a single
// response at 1000 rows by default, which would silently under-count.
export async function countsByPeople(personIds) {
  const counts = new Map(personIds.map((id) => [id, 0]));
  if (!personIds.length) return counts;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('attendances').select('id, person_id').in('person_id', personIds).order('id').range(from, from + PAGE - 1);
    if (error) throw fromDbError(error);
    for (const row of data) counts.set(row.person_id, (counts.get(row.person_id) ?? 0) + 1);
    if (data.length < PAGE) break;
  }
  return counts;
}

export async function listByPerson(personId, { limit = 50 } = {}) {
  return unwrap(await db.from('attendances').select(COLS).eq('person_id', personId).order('visited_at', { ascending: false }).limit(limit));
}

export async function listByDate(date) {
  return unwrap(
    await db
      .from('attendances')
      .select('id, visited_at, person:people(id, full_name, phone, email), recorder:users!recorded_by(id, full_name)')
      .eq('visited_at', date)
      .order('id'),
  );
}
