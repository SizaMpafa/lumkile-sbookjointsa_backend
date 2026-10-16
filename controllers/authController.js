import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import * as userModel from '../models/userModel.js';
import { buildProfile } from '../services/profileService.js';
import { HttpError } from '../utils/errors.js';
import { cleanEmail } from '../utils/validate.js';

const mustChange = (authUser) => Boolean(authUser?.app_metadata?.must_change_password);

function sessionPayload(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: 'bearer',
  };
}

// POST /api/auth/login  { email, password }
// One login for everyone. The response includes the user's role, and the frontend uses it to
// decide whether to show the staff portal or the customer portal.
export async function login(req, res) {
  const b = req.body ?? {};
  const email = cleanEmail(b.email);
  if (typeof b.password !== 'string' || !b.password) throw new HttpError(400, 'password is required.');

  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password: b.password });
  if (error || !data?.session) throw new HttpError(401, 'Incorrect email or password.');

  const user = await userModel.getById(data.user.id);
  if (!user) throw new HttpError(403, "This login isn't linked to a Book Joint account.");

  res.json({ ...sessionPayload(data.session), user, must_change_password: mustChange(data.user) });
}

// POST /api/auth/refresh  { refresh_token }
export async function refresh(req, res) {
  const token = req.body?.refresh_token;
  if (typeof token !== 'string' || !token) throw new HttpError(400, 'refresh_token is required.');

  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: token });
  if (error || !data?.session) throw new HttpError(401, 'Your session has expired. Please log in again.');

  res.json(sessionPayload(data.session));
}

// POST /api/auth/logout
export async function logout(req, res) {
  await supabaseAdmin.auth.admin.signOut(req.token, 'local').catch(() => {});
  res.json({ message: 'Logged out.' });
}

// GET /api/auth/me : who am I + (for customers) my visits and open requests
export async function me(req, res) {
  res.json({ ...(await buildProfile(req.user)), must_change_password: mustChange(req.authUser) });
}

// POST /api/auth/change-password  { current_password, new_password }
export async function changePassword(req, res) {
  const b = req.body ?? {};
  if (typeof b.current_password !== 'string' || !b.current_password) throw new HttpError(400, 'current_password is required.');
  if (typeof b.new_password !== 'string' || b.new_password.length < 8 || b.new_password.length > 72) {
    throw new HttpError(400, 'new_password must be between 8 and 72 characters.');
  }
  if (b.new_password === b.current_password) throw new HttpError(400, 'Choose a password different from the current one.');

  // prove they know the current password (fresh client, so no session leaks anywhere)
  const { error: verifyError } = await createAuthClient().auth.signInWithPassword({ email: req.user.email, password: b.current_password });
  if (verifyError) throw new HttpError(401, 'Current password is incorrect.');

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
    password: b.new_password,
    app_metadata: { must_change_password: false },
  });
  if (error) {
    console.error('[auth.updateUser]', error);
    throw new HttpError(400, error.message || 'Could not change the password.');
  }
  res.json({ message: 'Password changed.' });
}
