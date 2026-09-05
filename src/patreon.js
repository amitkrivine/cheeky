const crypto = require('crypto');

const { PATREON_WEBHOOK_SECRET } = process.env;

/**
 * Patreon signs each webhook body with HMAC-MD5 using your webhook secret,
 * sent in the `X-Patreon-Signature` header. Verify it before trusting the payload.
 */
function isValidSignature(rawBody, signatureHeader) {
  if (!PATREON_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto
    .createHmac('md5', PATREON_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

/**
 * Pulls the fields we care about out of a Patreon members:pledge:* webhook payload.
 */
function parseMemberPayload(payload) {
  const data = payload.data;
  const attrs = data.attributes || {};
  const patreonUserId = data.relationships?.user?.data?.id || data.id;
  const email = attrs.email || attrs.patron_email || null;
  // next_charge_date tells us when the current paid period ends
  const nextChargeDate = attrs.next_charge_date;
  return { patreonUserId, email, nextChargeDate, patronStatus: attrs.patron_status };
}

module.exports = { isValidSignature, parseMemberPayload };
