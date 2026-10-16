import { supabaseAdmin } from '../config/supabase.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/errors.js';
import { toUuid } from '../utils/validate.js';

// Reads "Authorization: Bearer <access_token>", asks Supabase Auth whether the token is genuine
// and unexpired (no jsonwebtoken needed), then loads the matching row from our `users` table.
// After this runs, req.user = { id, role, person_id, full_name, phone, email, ... }.
export async function requireLogin(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw new HttpError(401, 'Please log in.');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please log in again.');

  const user = await userModel.getById(data.user.id);
  if (!user) throw new HttpError(403, "This login isn't linked to a Book Joint account.");

  req.user = user;
  req.authUser = data.user;
  req.token = token;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) throw new HttpError(403, "You don't have permission to do that.");
  next();
};

export const requireStaff = requireRole('staff');
export const requireCustomer = requireRole('customer');

// Staff can act on any user; everyone else only on themselves.
export const requireSelfOrStaff = (param = 'id') => (req, res, next) => {
  const id = toUuid(req.params[param]);
  if (req.user.role !== 'staff' && req.user.id !== id) throw new HttpError(403, "You don't have permission to do that.");
  next();
};
