// Creates real login accounts (staff or customer).
// The password is NEVER stored by us: it is generated here, handed to Supabase Auth (which hashes
// and keeps it in its own auth schema), emailed to the person, and then forgotten.
import { supabaseAdmin } from '../config/supabase.js';
import * as userModel from '../models/userModel.js';
import { generatePassword } from '../utils/password.js';
import { sendMail, credentialsEmail } from '../utils/mailer.js';
import { HttpError } from '../utils/errors.js';

const EMAIL_FAILED =
  'The login email could not be sent, so nothing was saved. Check the email address / email settings and try again.';

export async function createLoginAccount({ role, person_id = null, full_name, phone, email }) {
  const password = generatePassword(8);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email: staff already verified them in person
    user_metadata: { full_name },
    // app_metadata can only be changed with the service key (users can't edit it themselves)
    app_metadata: { must_change_password: true },
  });

  if (error) {
    if (error.code === 'email_exists' || /already (been )?registered/i.test(error.message)) {
      throw new HttpError(409, 'Another account already uses this email address.');
    }
    console.error('[auth.createUser]', error);
    throw new HttpError(502, 'Could not create the login account.');
  }

  const authId = data.user.id;
  const undo = async () => {
    await userModel.remove(authId).catch(() => {});
    await supabaseAdmin.auth.admin.deleteUser(authId).catch(() => {});
  };

  let user;
  try {
    user = await userModel.create({ id: authId, person_id, role, full_name, phone, email });
  } catch (err) {
    await undo();
    throw err;
  }

  try {
    await sendMail(credentialsEmail({ fullName: full_name, email, password }));
  } catch (err) {
    console.error('[mail]', err.message);
    await undo(); // no email = the person could never learn their password, so don't keep the account
    throw new HttpError(502, EMAIL_FAILED);
  }

  return user;
}

export async function resetPassword(user) {
  const password = generatePassword(8);
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { must_change_password: true },
  });
  if (error) {
    console.error('[auth.updateUser]', error);
    throw new HttpError(502, 'Could not reset the password.');
  }
  try {
    await sendMail(credentialsEmail({ fullName: user.full_name, email: user.email, password, isReset: true }));
  } catch (err) {
    console.error('[mail]', err.message);
    throw new HttpError(502, 'The password was reset but the email failed to send. Reset it again to retry.');
  }
}
