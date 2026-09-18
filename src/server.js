require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const { isValidSignature, parseMemberPayload } = require('./patreon');
const {
  upsertMember, setInviteLink, markStatus, getMember,
  setPendingCode, getMemberByPendingCode, clearPendingCode, setTelegramUserId,
  markEmailed, wasRecentlyEmailed,
} = require('./db');
const { kickMember, buildDeepLink, registerStartHandler } = require('./telegram');
const { sendDeepLinkEmail } = require('./mailer');
const { startExpiryCron } = require('./cronExpire');

registerStartHandler({ getMemberByPendingCode, setTelegramUserId, clearPendingCode, setInviteLink });

const app = express();
const PORT = process.env.PORT || 3000;
const MEMBERSHIP_DAYS = Number(process.env.MEMBERSHIP_DAYS || 30);

// We need the RAW body (not parsed JSON) to verify Patreon's HMAC signature,
// so capture it via the `verify` hook before express.json() parses it.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhooks/patreon', async (req, res) => {
  const signature = req.header('X-Patreon-Signature');

  if (!isValidSignature(req.rawBody, signature)) {
    console.warn('Rejected webhook: invalid signature');
    return res.status(403).send('invalid signature');
  }

  // Patreon tells us which event this is via this header, e.g.
  // "members:pledge:create", "members:pledge:update", "members:pledge:delete"
  const event = req.header('X-Patreon-Event') || '';
  const { patreonUserId, email } = parseMemberPayload(req.body);

  if (!patreonUserId) {
    return res.status(400).send('missing user id in payload');
  }

  try {
    if (event === 'members:pledge:create' || event === 'members:pledge:update') {
      const expiresAt = new Date(Date.now() + MEMBERSHIP_DAYS * 24 * 60 * 60 * 1000).toISOString();
      upsertMember({ patreonUserId, email, expiresAt, status: 'active' });

      const code = crypto.randomBytes(16).toString('hex');
      setPendingCode(patreonUserId, code);
      const deepLink = buildDeepLink(code);

      if (wasRecentlyEmailed(patreonUserId)) {
        // Patreon sometimes fires two webhooks (e.g. create then update) for
        // what is really the same signup — skip re-sending in that case.
        console.log(`Skipped duplicate email for ${patreonUserId} (${email}) — already emailed recently`);
      } else if (email) {
        try {
          await sendDeepLinkEmail(email, deepLink);
          markEmailed(patreonUserId);
          console.log(`New/renewed member ${patreonUserId} (${email}) -> email sent with deep link`);
        } catch (mailErr) {
          // Don't fail the whole webhook just because the email send failed —
          // log it clearly so you can resend manually if needed.
          console.error(`Email send failed for ${patreonUserId} (${email}):`, mailErr.message);
        }
      } else {
        console.warn(`No email on file for member ${patreonUserId}; deep link: ${deepLink}`);
      }

    } else if (event === 'members:pledge:delete') {
      const member = getMember(patreonUserId);
      markStatus(patreonUserId, 'removed');

      if (member?.telegram_user_id) {
        await kickMember(member.telegram_user_id);
        console.log(`Removed cancelled member ${patreonUserId} from the group`);
      }
    } else {
      console.log(`Ignored event type: ${event}`);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Error handling webhook:', err);
    // Return 200 anyway so Patreon doesn't endlessly retry a permanently-failing payload;
    res.status(200).send('handled with errors');
  }
});

startExpiryCron();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
