const Database = require('better-sqlite3');
const path = require('path');

// If DB_PATH is set (e.g. pointing into a mounted Volume on Railway), use it —
// otherwise fall back to a local file for development.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    patreon_user_id   TEXT PRIMARY KEY,
    email              TEXT,
    telegram_user_id   TEXT,
    status             TEXT NOT NULL DEFAULT 'active', -- active | expired | removed
    expires_at         TEXT NOT NULL,                  -- ISO date string
    last_invite_link   TEXT,
    pending_code       TEXT,                           -- one-time code used in the /start deep link
    last_emailed_at    TEXT,                           -- ISO timestamp of the last link email we sent
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function upsertMember({ patreonUserId, email, expiresAt, status = 'active' }) {
  const stmt = db.prepare(`
    INSERT INTO members (patreon_user_id, email, status, expires_at, updated_at)
    VALUES (@patreonUserId, @email, @status, @expiresAt, datetime('now'))
    ON CONFLICT(patreon_user_id) DO UPDATE SET
      email = excluded.email,
      status = excluded.status,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `);
  stmt.run({ patreonUserId, email, status, expiresAt });
}

function setInviteLink(patreonUserId, link) {
  db.prepare(`UPDATE members SET last_invite_link = ? WHERE patreon_user_id = ?`)
    .run(link, patreonUserId);
}

function setTelegramUserId(patreonUserId, telegramUserId) {
  db.prepare(`UPDATE members SET telegram_user_id = ? WHERE patreon_user_id = ?`)
    .run(telegramUserId, patreonUserId);
}

function setPendingCode(patreonUserId, code) {
  db.prepare(`UPDATE members SET pending_code = ? WHERE patreon_user_id = ?`)
    .run(code, patreonUserId);
}

function getMemberByPendingCode(code) {
  return db.prepare(`SELECT * FROM members WHERE pending_code = ?`).get(code);
}

function clearPendingCode(patreonUserId) {
  db.prepare(`UPDATE members SET pending_code = NULL WHERE patreon_user_id = ?`)
    .run(patreonUserId);
}

function markEmailed(patreonUserId) {
  db.prepare(`UPDATE members SET last_emailed_at = datetime('now') WHERE patreon_user_id = ?`)
    .run(patreonUserId);
}

/**
 * Returns true if we already sent this member a link email within the last
 * `windowMinutes` — used to avoid double-emailing when Patreon fires two
 * webhooks (e.g. create + update) for what is really the same signup.
 */
function wasRecentlyEmailed(patreonUserId, windowMinutes = 5) {
  const row = db.prepare(`
    SELECT 1 FROM members
    WHERE patreon_user_id = ?
      AND last_emailed_at IS NOT NULL
      AND last_emailed_at > datetime('now', '-' || ? || ' minutes')
  `).get(patreonUserId, windowMinutes);
  return !!row;
}

function markStatus(patreonUserId, status) {
  db.prepare(`UPDATE members SET status = ?, updated_at = datetime('now') WHERE patreon_user_id = ?`)
    .run(status, patreonUserId);
}

function getMember(patreonUserId) {
  return db.prepare(`SELECT * FROM members WHERE patreon_user_id = ?`).get(patreonUserId);
}

function getExpiredActiveMembers(nowIso) {
  return db.prepare(`
    SELECT * FROM members WHERE status = 'active' AND expires_at <= ?
  `).all(nowIso);
}

module.exports = {
  db,
  upsertMember,
  setInviteLink,
  setTelegramUserId,
  setPendingCode,
  getMemberByPendingCode,
  clearPendingCode,
  markStatus,
  markEmailed,
  wasRecentlyEmailed,
  getMember,
  getExpiredActiveMembers,
};
