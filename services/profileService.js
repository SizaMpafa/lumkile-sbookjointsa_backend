import * as visitorModel from '../models/visitorModel.js';
import * as attendanceModel from '../models/attendanceModel.js';
import * as loanRequestModel from '../models/loanRequestModel.js';

// A user's profile. Staff: just the account. Customers: the account plus everything tied to their
// person record (visits) and their open book requests / loans.
export async function buildProfile(user) {
  if (user.role !== 'customer') return { user };

  const hasPerson = Boolean(user.person_id);
  const [person, visit_count, recent_attendances, open] = await Promise.all([
    hasPerson ? visitorModel.getById(user.person_id) : null,
    hasPerson ? attendanceModel.countByPerson(user.person_id) : 0,
    hasPerson ? attendanceModel.listByPerson(user.person_id, { limit: 10 }) : [],
    loanRequestModel.list({ requested_by: user.id, status: 'open', limit: 50 }),
  ]);

  return { user, person, visit_count, recent_attendances, open_requests: open.rows };
}
