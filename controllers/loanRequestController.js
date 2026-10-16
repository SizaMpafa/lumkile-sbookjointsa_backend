import * as loanRequestModel from '../models/loanRequestModel.js';
import * as bookModel from '../models/bookModel.js';
import { LOAN_WEEKS } from '../config/settings.js';
import { HttpError } from '../utils/errors.js';
import { toId, pagination, firstString } from '../utils/validate.js';
import { todayISO, addDaysISO, isISODate } from '../utils/dates.js';

// POST /api/loan-requests  { book_id }   (customer asks to borrow a book)
export async function create(req, res) {
  const book_id = toId(req.body?.book_id, 'book_id');

  // Claim the book FIRST, in a single conditional update (available -> requested).
  // If two customers click at the same moment, only one update matches; the other gets a 409.
  const claimed = await bookModel.claimAvailable(book_id);
  if (!claimed) {
    const book = await bookModel.getById(book_id);
    if (!book) throw new HttpError(404, 'Book not found.');
    if (!book.is_lendable) throw new HttpError(409, 'This book is for browsing only. It is not available to borrow.');
    throw new HttpError(409, 'This book has just been requested by someone else or is already out on loan.');
  }

  try {
    const request = await loanRequestModel.create({ book_id, requested_by: req.user.id });
    res.status(201).json({ request });
  } catch (err) {
    await bookModel.transition(book_id, 'requested', 'available'); // put the book back
    throw err;
  }
}

// GET /api/loan-requests/mine?status=open|pending|active|returned|declined|all   (customer)
export async function mine(req, res) {
  const status = parseStatus(req.query.status);
  const { limit, offset } = pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const { rows, count } = await loanRequestModel.list({ status, requested_by: req.user.id, today: todayISO(), limit, offset });
  res.json({ requests: rows, count });
}

// GET /api/loan-requests?status=pending|active|overdue|returned|declined|approved|open|all   (staff)
export async function list(req, res) {
  const status = parseStatus(req.query.status);
  const { limit, offset } = pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const { rows, count } = await loanRequestModel.list({ status, today: todayISO(), limit, offset });
  res.json({ requests: rows, count });
}

// GET /api/loan-requests/:id   (staff: any, customer: only their own)
export async function get(req, res) {
  const request = await loanRequestModel.getById(toId(req.params.id));
  // 404 (not 403) for someone else's request, so ids can't be probed
  if (!request || (req.user.role !== 'staff' && request.requested_by !== req.user.id)) {
    throw new HttpError(404, 'Request not found.');
  }
  res.json({ request });
}

// PATCH /api/loan-requests/:id/approve  { due_date? | weeks? }   (staff)
// Default return date = today + 1/2/3 weeks depending on the book's length (short/medium/long).
export async function approve(req, res) {
  const id = toId(req.params.id);
  const b = req.body ?? {};

  const existing = await loanRequestModel.getById(id);
  if (!existing) throw new HttpError(404, 'Request not found.');
  if (existing.decision !== 'pending') throw new HttpError(409, `This request was already ${existing.decision}.`);

  const today = todayISO();
  let due_date;
  if (b.due_date !== undefined) {
    if (!isISODate(b.due_date) || b.due_date <= today) throw new HttpError(400, 'due_date must be a future date like 2026-10-12.');
    due_date = b.due_date;
  } else {
    const weeks = b.weeks !== undefined ? Number(b.weeks) : LOAN_WEEKS[existing.book?.length] ?? LOAN_WEEKS.medium;
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new HttpError(400, 'weeks must be a whole number from 1 to 12.');
    due_date = addDaysISO(today, weeks * 7);
  }

  const decided = await loanRequestModel.decide(id, { decision: 'approved', decided_by: req.user.id, due_date });
  if (!decided) throw new HttpError(409, 'This request was just decided by someone else.');

  await bookModel.transition(existing.book_id, 'requested', 'on_loan');
  res.json({ request: await loanRequestModel.getById(id) });
}

// PATCH /api/loan-requests/:id/decline   (staff): the book goes straight back to 'available'
export async function decline(req, res) {
  const id = toId(req.params.id);
  const existing = await loanRequestModel.getById(id);
  if (!existing) throw new HttpError(404, 'Request not found.');
  if (existing.decision !== 'pending') throw new HttpError(409, `This request was already ${existing.decision}.`);

  const decided = await loanRequestModel.decide(id, { decision: 'declined', decided_by: req.user.id });
  if (!decided) throw new HttpError(409, 'This request was just decided by someone else.');

  await bookModel.transition(existing.book_id, 'requested', 'available');
  res.json({ request: await loanRequestModel.getById(id) });
}

// PATCH /api/loan-requests/:id/return   (staff): the book is back on the shelf
export async function markReturned(req, res) {
  const id = toId(req.params.id);
  const returned = await loanRequestModel.markReturned(id);
  if (!returned) {
    const existing = await loanRequestModel.getById(id);
    if (!existing) throw new HttpError(404, 'Request not found.');
    throw new HttpError(409, existing.returned_at ? 'This book was already marked as returned.' : 'This request is not an active loan.');
  }

  await bookModel.transition(returned.book_id, 'on_loan', 'available');
  res.json({ request: await loanRequestModel.getById(id) });
}

function parseStatus(value) {
  const status = String(firstString(value) ?? 'all');
  if (!loanRequestModel.STATUS_FILTERS.includes(status)) {
    throw new HttpError(400, `status must be one of: ${loanRequestModel.STATUS_FILTERS.join(', ')}.`);
  }
  return status;
}
