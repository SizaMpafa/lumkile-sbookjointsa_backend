export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

// Postgres error codes -> friendly HTTP errors
const DB_ERRORS = {
  '23505': [409, 'That record already exists.'],
  '23503': [409, 'That record is linked to other records, so this change is not allowed.'],
  '23514': [400, 'One of the values is not allowed.'],
  '23502': [400, 'A required value is missing.'],
  '22P02': [400, 'One of the values is in the wrong format.'],
};

export function fromDbError(error) {
  const known = DB_ERRORS[error.code];
  if (known) return new HttpError(known[0], known[1]);
  console.error('[db error]', error); // full detail stays in your terminal / Render logs
  return new HttpError(500, 'Database error.');
}

// Supabase returns { data, error } instead of throwing. unwrap() throws so controllers stay clean.
export function unwrap({ data, error }) {
  if (error) throw fromDbError(error);
  return data;
}

export function unwrapWithCount({ data, count, error }) {
  if (error) throw fromDbError(error);
  return { rows: data, count: count ?? 0 };
}
