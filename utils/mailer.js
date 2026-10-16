// Sends email through Brevo's HTTPS API (port 443).
// Why not SMTP/nodemailer: Render's free tier blocks outbound SMTP ports 25/465/587.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendMail({ to, toName, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL;
  const senderName = process.env.MAIL_FROM_NAME || "Lumkile's Book Joint";

  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured (BREVO_API_KEY / MAIL_FROM_EMAIL).');
    }
    // Local development without a mail key: print the email instead of sending it.
    console.log(`\n--- [dev mail, not sent] ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n----------------------------\n`);
    return { dev: true };
  }

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: toName }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error('[mail error]', res.status, await res.text().catch(() => ''));
    throw new Error(`Email provider rejected the message (${res.status}).`);
  }
  return res.json().catch(() => ({}));
}

export function credentialsEmail({ fullName, email, password, isReset = false }) {
  const loginUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim() || '';
  const subject = isReset ? "Your new Lumkile's Book Joint password" : "Your Lumkile's Book Joint login";
  const intro = isReset
    ? 'Your password has been reset. Here are your new login details:'
    : "Your Lumkile's Book Joint account is ready. Here are your login details:";

  const text = [
    `Hi ${fullName},`,
    '',
    intro,
    '',
    `Email: ${email}`,
    `Password: ${password}`,
    loginUrl ? `Log in: ${loginUrl}` : '',
    '',
    'Please change this password after you log in.',
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#24301F;line-height:1.5">
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>${escapeHtml(intro)}</p>
      <p style="background:#F4F0E4;padding:14px 16px;border-radius:8px">
        <strong>Email:</strong> ${escapeHtml(email)}<br>
        <strong>Password:</strong> <span style="font-family:monospace;font-size:17px">${escapeHtml(password)}</span>
      </p>
      ${loginUrl ? `<p><a href="${escapeHtml(loginUrl)}">Log in to Lumkile's Book Joint</a></p>` : ''}
      <p>Please change this password after you log in.</p>
    </div>`;

  return { to: email, toName: fullName, subject, text, html };
}
