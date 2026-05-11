'use strict';

/**
 * Throws if JWT_SECRET is missing or too weak (call before signing/verifying JWTs).
 */
function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
}

module.exports = { requireJwtSecret };
