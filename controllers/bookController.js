import * as bookModel from '../models/bookModel.js';
import { HttpError } from '../utils/errors.js';
import { cleanText, cleanLength, toId, toBool, pagination, firstString } from '../utils/validate.js';

const FILTERS = ['all', 'available', 'requested', 'on_loan', 'library_only'];

// POST /api/books  { title, author, length?, is_lendable? }   (staff)
export async function create(req, res) {
  const b = req.body ?? {};
  const book = await bookModel.create({
    title: cleanText(b.title, 'title'),
    author: cleanText(b.author, 'author'),
    length: b.length === undefined ? 'medium' : cleanLength(b.length),
    is_lendable: b.is_lendable === undefined ? false : toBool(b.is_lendable, 'is_lendable'),
  });
  res.status(201).json({ book });
}

// GET /api/books?filter=available&q=&limit=&offset=
// filter can be a comma list: all | available | requested | on_loan | library_only
// e.g. ?filter=requested,on_loan is the "On loan" tab.
export async function list(req, res) {
  const raw = String(firstString(req.query.filter) ?? 'all');
  const filters = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const invalid = filters.filter((f) => !FILTERS.includes(f));
  if (invalid.length) throw new HttpError(400, `Unknown filter: ${invalid.join(', ')}. Use: ${FILTERS.join(', ')}.`);

  const q = String(firstString(req.query.q) ?? '').trim();
  const { limit, offset } = pagination(req.query, { defaultLimit: 100, maxLimit: 500 });
  const { rows, count } = await bookModel.list({ filters, q: q || undefined, limit, offset });
  res.json({ books: rows, count });
}

// GET /api/books/stats : numbers for the dashboard cards
export async function stats(req, res) {
  res.json(await bookModel.stats());
}

// GET /api/books/:id
export async function get(req, res) {
  const book = await bookModel.getById(toId(req.params.id));
  if (!book) throw new HttpError(404, 'Book not found.');
  res.json({ book });
}

// PATCH /api/books/:id  { title?, author?, length? }   (staff)
export async function update(req, res) {
  const id = toId(req.params.id);
  const b = req.body ?? {};
  const fields = {};
  if (b.title !== undefined) fields.title = cleanText(b.title, 'title');
  if (b.author !== undefined) fields.author = cleanText(b.author, 'author');
  if (b.length !== undefined) fields.length = cleanLength(b.length);
  if (!Object.keys(fields).length) throw new HttpError(400, 'Send at least one of: title, author, length.');

  const book = await bookModel.update(id, fields);
  if (!book) throw new HttpError(404, 'Book not found.');
  res.json({ book });
}

// PATCH /api/books/:id/lendable  { is_lendable: true|false }   (staff)
// true  = avail it for lending (status becomes 'available')
// false = take it out of the lending pool (status cleared); refused while it is requested / out
export async function setLendable(req, res) {
  const book = await bookModel.setLendable(toId(req.params.id), toBool(req.body?.is_lendable, 'is_lendable'));
  res.json({ book });
}

// DELETE /api/books/:id   (staff): only books with no loan history
export async function remove(req, res) {
  const id = toId(req.params.id);
  if (!(await bookModel.getById(id))) throw new HttpError(404, 'Book not found.');
  await bookModel.remove(id);
  res.json({ message: 'Book deleted.' });
}
