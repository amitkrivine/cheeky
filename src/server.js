require('dotenv').config();
const express = require('express');
const { isValidSignature, parseMemberPayload } = require('./patreon');
const { upsertMember, setInviteLink, markStatus, getMember } = require('./db');
const { createOneTimeInviteLink, kickMember } = require('./telegram');
const { startExpiryCron } = require('./cronExpire');

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

      const link = await createOneTimeInviteLink();
      setInviteLink(patreonUserId, link);

      // TODO: send `link` to the patron — e.g. email via your mailer,
      // or a Patreon DM through the API. Logged here as a placeholder.
      console.log(`New/renewed member ${patreonUserId} (${email}) -> invite link: ${link}`);

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
    // switch to 500 while debugging if you want Patreon's automatic retries.
    res.status(200).send('handled with errors');
  }
});

startExpiryCron();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
