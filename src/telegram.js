const TelegramBot = require('node-telegram-bot-api');

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_GROUP_ID,
  INVITE_LINK_VALID_MINUTES = 60,
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_GROUP_ID) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_ID in .env');
}

// polling: true — the bot needs to receive incoming /start messages
// (sent when a patron clicks their personal deep link) in addition to calling the API.
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

/**
 * Creates a single-use invite link that expires after INVITE_LINK_VALID_MINUTES.
 * member_limit: 1 makes it usable exactly once.
 */
async function createOneTimeInviteLink() {
  const expireDate = Math.floor(Date.now() / 1000) + Number(INVITE_LINK_VALID_MINUTES) * 60;
  const result = await bot.createChatInviteLink(TELEGRAM_GROUP_ID, {
    member_limit: 1,
    expire_date: expireDate,
  });
  return result.invite_link;
}

/**
 * Removes a user from the group, then immediately un-bans them so they are
 * merely "kicked" (able to be re-added later) rather than permanently banned.
 */
async function kickMember(telegramUserId) {
  await bot.banChatMember(TELEGRAM_GROUP_ID, telegramUserId);
  await bot.unbanChatMember(TELEGRAM_GROUP_ID, telegramUserId, { only_if_banned: true });
}

/**
 * Builds the personal deep link a patron clicks to identify themselves to the bot.
 * Requires the bot's @username (find it via @BotFather, or in .env as TELEGRAM_BOT_USERNAME).
 */
function buildDeepLink(code) {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  return `https://t.me/${username}?start=${code}`;
}

/**
 * Registers the /start handler. Call this once at startup, passing the db
 * functions needed to look up and update a member by their pending code.
 */
function registerStartHandler({ getMemberByPendingCode, setTelegramUserId, clearPendingCode, setInviteLink }) {
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const code = match[1];

    if (!code) {
      await bot.sendMessage(chatId, 'שלום! זה הבוט לניהול המנוי שלך. הקישור האישי שלך יגיע אליך אחרי שתירשם/תחדש מנוי.');
      return;
    }

    const member = getMemberByPendingCode(code);
    if (!member) {
      await bot.sendMessage(chatId, 'הקישור הזה כבר לא בתוקף. אם חידשת עכשיו את המנוי, בדוק אם קיבלת קישור חדש יותר.');
      return;
    }

    // Link this Telegram user to their Patreon record so we know whom to remove later.
    setTelegramUserId(member.patreon_user_id, String(msg.from.id));
    clearPendingCode(member.patreon_user_id);

    const inviteLink = await createOneTimeInviteLink();
    setInviteLink(member.patreon_user_id, inviteLink);

    await bot.sendMessage(chatId, `תודה! הנה הקישור החד-פעמי שלך לקבוצה:\n${inviteLink}\n\nהקישור תקף לשימוש אחד בלבד ולזמן מוגבל.`);
  });

  console.log('Telegram /start handler registered.');
}

module.exports = { bot, createOneTimeInviteLink, kickMember, buildDeepLink, registerStartHandler };
