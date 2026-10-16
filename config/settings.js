import 'dotenv/config';

//minimum visits needed for a visitor before staff can create an account for them.
export const MIN_VISITS_TO_REGISTER = Number(process.env.MIN_VISITS_TO_REGISTER ?? 2);

// Default loan length by book length (weeks). Staff can override per approval.
export const LOAN_WEEKS = { short: 1, medium: 2, long: 3 };
export const BOOK_LENGTHS = Object.keys(LOAN_WEEKS);



