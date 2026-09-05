const TelegramBot = require('node-telegram-bot-api');

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_GROUP_ID,
  INVITE_LINK_VALID_MINUTES = 60,
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_GROUP_ID) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_ID in .env');
}

// polling: false — we don't need to receive messages, only call the API.
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

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

module.exports = { bot, createOneTimeInviteLink, kickMember };
