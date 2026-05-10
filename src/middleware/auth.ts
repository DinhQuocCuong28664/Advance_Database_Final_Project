const jwt = require('jsonwebtoken');

import type { NextFunction, Request, Response } from 'express';
import type { SignOptions } from 'jsonwebtoken';

type AuthPayload = {
  sub?: string | number;
  user_id?: string | number;
  user_type?: string;
  roles?: string[];
  [key: string]: unknown;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload | null;
    }
  }
}

const AUTH_SECRET = process.env.AUTH_JWT_SECRET || 'luxereserve-dev-secret-change-me';
const AUTH_EXPIRES_IN = process.env.AUTH_JWT_EXPIRES_IN || '8h';

function issueAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: AUTH_EXPIRES_IN } as SignOptions);
}

function parseBearerToken(req: Request) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7).trim();
}

function decodeRequestToken(req: Request): AuthPayload | null {
  const token = parseBearerToken(req);
  if (!token) {
    return null;
  }

  return jwt.verify(token, AUTH_SECRET) as AuthPayload;
}

function attachAuthContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const decoded = decodeRequestToken(req);
    req.auth = decoded || null;
    next();
  } catch (_) {
    req.auth = null;
    next();
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
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

function requireSystemUser(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.user_type !== 'SYSTEM_USER') {
      return res.status(403).json({ success: false, error: 'System user access required' });
    }

    next();
  });
}

function hasSystemRole(auth: AuthPayload | null | undefined, roleCode: string) {
  return auth?.user_type === 'SYSTEM_USER'
    && Array.isArray(auth.roles)
    && auth.roles.includes(roleCode);
}

function requireSystemRole(roleCodes: string | string[]) {
  const allowedRoles = Array.isArray(roleCodes) ? roleCodes : [roleCodes];

  return (req: Request, res: Response, next: NextFunction) => {
    requireSystemUser(req, res, () => {
      if (allowedRoles.some((roleCode) => hasSystemRole(req.auth, roleCode))) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: `One of the following roles is required: ${allowedRoles.join(', ')}`,
      });
    });
  };
}

const requireAdminUser = requireSystemRole('ADMIN');
const requireManagerUser = requireSystemRole('MANAGER');
const requireAdminOrManagerUser = requireSystemRole(['ADMIN', 'MANAGER']);
const requireHousekeepingManagerUser = requireSystemRole('HK_MANAGER');

module.exports = {
  attachAuthContext,
  requireAuth,
  requireSystemUser,
  requireSystemRole,
  requireAdminUser,
  requireManagerUser,
  requireAdminOrManagerUser,
  requireHousekeepingManagerUser,
  hasSystemRole,
  issueAuthToken,
};
