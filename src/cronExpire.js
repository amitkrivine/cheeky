const cron = require('node-cron');
const { getExpiredActiveMembers, markStatus } = require('./db');
const { kickMember } = require('./telegram');

function startExpiryCron() {
  // Runs every day at 03:00 server time.
  cron.schedule('0 3 * * *', async () => {
    const nowIso = new Date().toISOString();
    const expired = getExpiredActiveMembers(nowIso);

    for (const member of expired) {
      try {
        if (member.telegram_user_id) {
          await kickMember(member.telegram_user_id);
          console.log(`Kicked expired member ${member.patreon_user_id}`);
        }
        markStatus(member.patreon_user_id, 'expired');
      } catch (err) {
        console.error(`Failed to remove member ${member.patreon_user_id}:`, err.message);
      }
    }
  });

  console.log('Expiry cron scheduled (daily 03:00).');
}

module.exports = { startExpiryCron };
