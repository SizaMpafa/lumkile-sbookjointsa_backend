import * as userModel from '../models/userModel.js';
import * as visitorModel from '../models/visitorModel.js';
import * as attendanceModel from '../models/attendanceModel.js';
import { createLoginAccount, resetPassword as resetAccountPassword } from '../services/accountService.js';
import { buildProfile } from '../services/profileService.js';
import { MIN_VISITS_TO_REGISTER } from '../config/settings.js';
import { HttpError } from '../utils/errors.js';
import { cleanName, cleanEmail, cleanPhone, toId, toUuid, pagination, firstString } from '../utils/validate.js';

// POST /api/users/staff  { full_name, phone, email }   (staff creates another staff member)
export async function createStaff(req, res) {
  const b = req.body ?? {};
  const full_name = cleanName(b.full_name);
  const phone = cleanPhone(b.phone);
  const email = cleanEmail(b.email);

  if (await userModel.getByEmail(email)) throw new HttpError(409, 'Another account already uses this email address.');

  const user = await createLoginAccount({ role: 'staff', person_id: null, full_name, phone, email });
  res.status(201).json({ user, message: `Staff account created. Login details were emailed to ${email}.` });
}

// POST /api/users/customers  { person_id }   (staff turns a visitor into a customer)
// Nothing is copied or moved: the visitor's attendance rows already point at person_id, and the
// new user row points at the same person_id, so their visit history "carries over" by itself.
export async function registerCustomer(req, res) {
  const person_id = toId(req.body?.person_id, 'person_id');

  const person = await visitorModel.getById(person_id);
  if (!person) throw new HttpError(404, 'Visitor not found.');
  if (await userModel.getByPersonId(person_id)) throw new HttpError(409, `${person.full_name} already has an account.`);

  const visit_count = await attendanceModel.countByPerson(person_id);
  if (visit_count < MIN_VISITS_TO_REGISTER) {
    throw new HttpError(
      409,
      `${person.full_name} has ${visit_count} recorded visit${visit_count === 1 ? '' : 's'}. They need at least ${MIN_VISITS_TO_REGISTER} before an account can be created.`,
      { visit_count, visits_needed: MIN_VISITS_TO_REGISTER - visit_count },
    );
  }

  // Families can share one email on paper, but a login needs its own unique email.
  if (await userModel.getByEmail(person.email)) {
    throw new HttpError(409, 'Another account already uses this email address. Update the visitor\'s email (PATCH /api/visitors/:id) and try again.');
  }

  const user = await createLoginAccount({
    role: 'customer',
    person_id,
    full_name: person.full_name,
    phone: person.phone,
    email: person.email,
  });
  res.status(201).json({ user, visit_count, message: `Account created. Login details were emailed to ${person.email}.` });
}

// GET /api/users?role=customer&q=&limit=&offset=   (staff)
export async function list(req, res) {
  const role = firstString(req.query.role);
  if (role !== undefined && !['staff', 'customer'].includes(role)) throw new HttpError(400, "role must be 'staff' or 'customer'.");
  const q = String(firstString(req.query.q) ?? '').trim();
  const { limit, offset } = pagination(req.query);
  const { rows, count } = await userModel.list({ role, q: q || undefined, limit, offset });
  res.json({ users: rows, count });
}

// GET /api/users/:id   (staff, or the user themselves)
export async function getById(req, res) {
  const user = await userModel.getById(toUuid(req.params.id));
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user });
}

// GET /api/users/:id/profile : account + visits + open requests/loans
export async function profile(req, res) {
  const user = await userModel.getById(toUuid(req.params.id));
  if (!user) throw new HttpError(404, 'User not found.');
  res.json(await buildProfile(user));
}

// PATCH /api/users/:id  { full_name?, phone? }   (staff, or the user themselves)
export async function update(req, res) {
  const id = toUuid(req.params.id);
  const b = req.body ?? {};
  const fields = {};
  if (b.full_name !== undefined) fields.full_name = cleanName(b.full_name);
  if (b.phone !== undefined) fields.phone = cleanPhone(b.phone);
  if (!Object.keys(fields).length) throw new HttpError(400, 'Send at least one of: full_name, phone.');

  const user = await userModel.update(id, fields);
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ user });
}

// POST /api/users/:id/reset-password   (staff): new random password, emailed to them
export async function resetPassword(req, res) {
  const user = await userModel.getById(toUuid(req.params.id));
  if (!user) throw new HttpError(404, 'User not found.');
  await resetAccountPassword(user);
  res.json({ message: `A new password was emailed to ${user.email}.` });
}
