const jwt = require('jsonwebtoken');

const AUTH_SECRET = process.env.AUTH_JWT_SECRET || 'luxereserve-dev-secret-change-me';
const AUTH_EXPIRES_IN = process.env.AUTH_JWT_EXPIRES_IN || '8h';

function issueAuthToken(payload) {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: AUTH_EXPIRES_IN });
}

function parseBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7).trim();
}

function decodeRequestToken(req) {
  const token = parseBearerToken(req);
  if (!token) {
    return null;
  }

  return jwt.verify(token, AUTH_SECRET);
}

function attachAuthContext(req, _res, next) {
  try {
    const decoded = decodeRequestToken(req);
    req.auth = decoded || null;
    next();
  } catch (_) {
    req.auth = null;
    next();
  }
}

function requireAuth(req, res, next) {
  try {
    const decoded = decodeRequestToken(req);
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    req.auth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireSystemUser(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth?.user_type !== 'SYSTEM_USER') {
      return res.status(403).json({ success: false, error: 'System user access required' });
    }

    next();
  });
}

module.exports = {
  attachAuthContext,
  requireAuth,
  requireSystemUser,
  issueAuthToken,
};
