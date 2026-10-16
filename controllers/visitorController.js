// "Visitors" = the `people` table.
import * as visitorModel from '../models/visitorModel.js';
import * as attendanceModel from '../models/attendanceModel.js';
import * as userModel from '../models/userModel.js';
import { MIN_VISITS_TO_REGISTER } from '../config/settings.js';
import { HttpError } from '../utils/errors.js';
import { cleanName, cleanEmail, cleanPhone, toId, pagination, firstString } from '../utils/validate.js';
import { todayISO } from '../utils/dates.js';

// Adds visit_count / is_registered / can_register to each person, so the frontend can grey out
// the "Register" button until they have enough visits.
async function withStats(people) {
  const ids = people.map((p) => p.id);
  const [counts, users] = await Promise.all([attendanceModel.countsByPeople(ids), userModel.getByPersonIds(ids)]);
  const registered = new Map(users.map((u) => [u.person_id, u.id]));

  return people.map((p) => {
    const visit_count = counts.get(p.id) ?? 0;
    const is_registered = registered.has(p.id);
    return {
      ...p,
      visit_count,
      is_registered,
      user_id: registered.get(p.id) ?? null,
      can_register: !is_registered && visit_count >= MIN_VISITS_TO_REGISTER,
      visits_needed: Math.max(0, MIN_VISITS_TO_REGISTER - visit_count),
    };
  });
}

// POST /api/visitors  { full_name, phone, email, confirm_new? }
// First-time visitor: creates the person AND records their first visit in one go.
export async function create(req, res) {
  const b = req.body ?? {};
  const full_name = cleanName(b.full_name);
  const phone = cleanPhone(b.phone);
  const email = cleanEmail(b.email);

  // Search-before-create safety net. Phones/emails can legitimately be shared (families), so this
  // only blocks until staff confirm it really is a different person.
  if (b.confirm_new !== true) {
    const duplicates = await visitorModel.findDuplicates({ phone, email });
    if (duplicates.length) {
      throw new HttpError(
        409,
        'Someone with this phone number or email is already on file. Record a visit for them instead, or resend with confirm_new: true if this is a different person.',
        { matches: await withStats(duplicates) },
      );
    }
  }

  const person = await visitorModel.create({ full_name, phone, email });
  let attendance;
  try {
    attendance = await attendanceModel.record({ person_id: person.id, visited_at: todayISO(), recorded_by: req.user.id });
  } catch (err) {
    await visitorModel.remove(person.id).catch(() => {}); // don't leave a person with no visit
    throw err;
  }

  const [withStat] = await withStats([person]);
  res.status(201).json({ person: withStat, attendance });
}

// GET /api/visitors/search?q=sipho   (name, phone or email)
export async function search(req, res) {
  const q = String(firstString(req.query.q) ?? '').trim();
  if (q.length < 2) throw new HttpError(400, 'Type at least 2 characters to search.');
  const people = await visitorModel.search(q, 20);
  res.json({ results: await withStats(people) });
}

// GET /api/visitors?limit=&offset=
export async function list(req, res) {
  const { limit, offset } = pagination(req.query);
  const { rows, count } = await visitorModel.list({ limit, offset });
  res.json({ people: await withStats(rows), count });
}

// GET /api/visitors/:id : the person + visit stats + visit history
export async function get(req, res) {
  const id = toId(req.params.id);
  const person = await visitorModel.getById(id);
  if (!person) throw new HttpError(404, 'Visitor not found.');

  const [[withStat], attendances] = await Promise.all([withStats([person]), attendanceModel.listByPerson(id, { limit: 100 })]);
  res.json({ person: withStat, attendances });
}

// PATCH /api/visitors/:id  { full_name?, phone?, email? }
// Fix typos before registering someone (e.g. a wrong email would get their password sent nowhere).
export async function update(req, res) {
  const id = toId(req.params.id);
  const b = req.body ?? {};

  const person = await visitorModel.getById(id);
  if (!person) throw new HttpError(404, 'Visitor not found.');
  if (await userModel.getByPersonId(id)) {
    throw new HttpError(409, 'This person already has an account, so edit their user record instead (PATCH /api/users/:id).');
  }

  const fields = {};
  if (b.full_name !== undefined) fields.full_name = cleanName(b.full_name);
  if (b.phone !== undefined) fields.phone = cleanPhone(b.phone);
  if (b.email !== undefined) fields.email = cleanEmail(b.email);
  if (!Object.keys(fields).length) throw new HttpError(400, 'Send at least one of: full_name, phone, email.');

  const updated = await visitorModel.update(id, fields);
  const [withStat] = await withStats([updated]);
  res.json({ person: withStat });
}
