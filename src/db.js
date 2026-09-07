const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    patreon_user_id   TEXT PRIMARY KEY,
    email              TEXT,
    telegram_user_id   TEXT,
    status             TEXT NOT NULL DEFAULT 'active', -- active | expired | removed
    expires_at         TEXT NOT NULL,                  -- ISO date string
    last_invite_link   TEXT,
    pending_code       TEXT,                           -- one-time code used in the /start deep link
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
  getMember,
  getExpiredActiveMembers,
};
