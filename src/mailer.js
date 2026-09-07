const { Resend } = require('resend');

const { RESEND_API_KEY, MAIL_FROM } = process.env;

if (!RESEND_API_KEY || !MAIL_FROM) {
  throw new Error('Missing RESEND_API_KEY or MAIL_FROM in .env');
}

const resend = new Resend(RESEND_API_KEY);

/**
 * Emails the patron their personal Telegram deep link.
 * Clicking it starts a chat with the bot, which then sends the actual
 * one-time group invite link once it has identified them.
 */
async function sendDeepLinkEmail(toEmail, deepLink) {
  const { error } = await resend.emails.send({
    from: MAIL_FROM,
    to: toEmail,
    subject: 'הקישור שלך לקבוצת הטלגרם',
    html: `
      <p>תודה על התמיכה! 🎉</p>
      <p>לחץ על הכפתור למטה כדי להצטרף לקבוצת הטלגרם - הוא ייפתח שיחה עם הבוט שישלח לך קישור חד-פעמי:</p>
      <p><a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#0088cc;color:#fff;text-decoration:none;border-radius:6px;">הצטרף לקבוצה</a></p>
      <p style="color:#888;font-size:12px;">אם הכפתור לא עובד, העתק את הקישור הזה לדפדפן בטלפון: ${deepLink}</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message || error}`);
  }
}

module.exports = { sendDeepLinkEmail };