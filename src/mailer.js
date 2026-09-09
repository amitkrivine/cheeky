const nodemailer = require('nodemailer');

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD, // must be an App Password, not your normal Gmail password
  },
});

/**
 * Emails the patron their personal Telegram deep link.
 * Clicking it starts a chat with the bot, which then sends the actual
 * one-time group invite link once it has identified them.
 */
async function sendDeepLinkEmail(toEmail, deepLink) {
  await transporter.sendMail({
    from: GMAIL_USER,
    to: toEmail,
    subject: 'הקישור שלך לקבוצת הטלגרם',
    html: `
      <p>תודה על התמיכה! 🎉</p>
      <p>לחץ על הכפתור למטה כדי להצטרף לקבוצת הטלגרם - הוא ייפתח שיחה עם הבוט שישלח לך קישור חד-פעמי:</p>
      <p><a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#0088cc;color:#fff;text-decoration:none;border-radius:6px;">הצטרף לקבוצה</a></p>
      <p style="color:#888;font-size:12px;">אם הכפתור לא עובד, העתק את הקישור הזה לדפדפן: ${deepLink}</p>
    `,
  });
}

module.exports = { sendDeepLinkEmail };
