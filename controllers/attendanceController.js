import * as attendanceModel from '../models/attendanceModel.js';
import * as visitorModel from '../models/visitorModel.js';
import { HttpError } from '../utils/errors.js';
import { toId, firstString } from '../utils/validate.js';
import { todayISO, isISODate } from '../utils/dates.js';

// POST /api/attendances  { person_id }   (staff records a visit for a visitor)
export async function recordForPerson(req, res) {
  const person_id = toId(req.body?.person_id, 'person_id');
  const person = await visitorModel.getById(person_id);
  if (!person) throw new HttpError(404, 'Visitor not found.');

  const attendance = await attendanceModel.record({ person_id, visited_at: todayISO(), recorded_by: req.user.id });
  res.status(201).json({ attendance, visit_count: await attendanceModel.countByPerson(person_id) });
}

// POST /api/attendances/me   (a registered customer records their own visit)
export async function recordMine(req, res) {
  const person_id = req.user.person_id;
  if (!person_id) throw new HttpError(409, "Your account isn't linked to a visitor record. Please ask staff for help.");

  const attendance = await attendanceModel.record({ person_id, visited_at: todayISO(), recorded_by: req.user.id });
  res.status(201).json({ attendance, visit_count: await attendanceModel.countByPerson(person_id) });
}

// GET /api/attendances/me
export async function listMine(req, res) {
  const person_id = req.user.person_id;
  if (!person_id) return res.json({ visit_count: 0, attendances: [] });
  const [visit_count, attendances] = await Promise.all([
    attendanceModel.countByPerson(person_id),
    attendanceModel.listByPerson(person_id, { limit: 100 }),
  ]);
  res.json({ visit_count, attendances });
}

// GET /api/attendances/person/:personId   (staff)
export async function listForPerson(req, res) {
  const person_id = toId(req.params.personId, 'personId');
  const [visit_count, attendances] = await Promise.all([
    attendanceModel.countByPerson(person_id),
    attendanceModel.listByPerson(person_id, { limit: 100 }),
  ]);
  res.json({ visit_count, attendances });
}

// GET /api/attendances?date=YYYY-MM-DD   (staff: who came in on a day, defaults to today)
export async function listByDate(req, res) {
  const raw = firstString(req.query.date);
  if (raw !== undefined && !isISODate(raw)) throw new HttpError(400, 'date must look like 2026-09-28.');
  const date = raw ?? todayISO();
  res.json({ date, attendances: await attendanceModel.listByDate(date) });
}
