// Creates a staff account from the command line. This is how the very FIRST staff member gets
// created (every other endpoint needs a logged-in staff member, so you need one to start).
//
//   node scripts/createStaff.js "Full Name" email@example.com 0712345678
//
// With BREVO_API_KEY set, the login details are emailed. Without it (and NODE_ENV not
// "production") the email is printed in this terminal instead, so you can grab the password.
import 'dotenv/config';
import { createLoginAccount } from '../services/accountService.js';
import { cleanName, cleanEmail, cleanPhone } from '../utils/validate.js';

const [, , nameArg, emailArg, phoneArg] = process.argv;

if (!nameArg || !emailArg || !phoneArg) {
  console.error('Usage: node scripts/createStaff.js "Full Name" email@example.com 0712345678');
  process.exit(1);
}

try {
  const user = await createLoginAccount({
    role: 'staff',
    person_id: null,
    full_name: cleanName(nameArg),
    email: cleanEmail(emailArg),
    phone: cleanPhone(phoneArg),
  });
  console.log(`Staff account created for ${user.full_name} (${user.email}).`);
  process.exit(0);
} catch (err) {
  console.error('Could not create staff account:', err.message);
  process.exit(1);
}
