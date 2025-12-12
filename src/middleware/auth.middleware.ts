/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyIdTokenStrict, verifySessionCookieStrict } from '../config/firebase';
import { appConfig } from '../config/env';
import { logger } from '../lib/logger';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  claims: DecodedIdToken;
  issuedAt: Date;
  expiresAt?: Date;
  tokenType: AuthTokenType;
}

export type AuthTokenType = 'id' | 'session';

export const SESSION_COOKIE_NAME = 'session';

const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) {
    return {};
  }

  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) {
      return acc;
    }
    const key = rawKey.trim();
    const value = rest.length > 0 ? rest.join('=') : '';
    acc[key] = decodeURIComponent(value ?? '');
    return acc;
  }, {});
};

const extractToken = (
  req: Request,
): { token?: string; source?: 'header' | 'cookie' | 'custom' } => {
  const authorization = req.headers.authorization ?? req.headers.Authorization;
  if (typeof authorization === 'string') {
    const [scheme, ...parts] = authorization.trim().split(/\s+/u);
    if (scheme?.toLowerCase() === 'bearer' && parts.length > 0) {
      return { token: parts.join(' '), source: 'header' };
    }
  }

  const customHeader = req.headers['x-firebase-auth'];
  if (typeof customHeader === 'string' && customHeader.trim().length > 0) {
    return { token: customHeader.trim(), source: 'custom' };
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined;
  const cookies = parseCookies(cookieHeader);
  if (cookies[SESSION_COOKIE_NAME]) {
    return { token: cookies[SESSION_COOKIE_NAME], source: 'cookie' };
  }

  return {};
};

const verifyAuthToken = async (
  token: string,
): Promise<{ decoded: DecodedIdToken; tokenType: AuthTokenType }> => {
  try {
    const decoded = await verifyIdTokenStrict(token, true);
    return { decoded, tokenType: 'id' };
  } catch (idTokenError) {
    try {
      const decoded = await verifySessionCookieStrict(token, true);
      return { decoded, tokenType: 'session' };
    } catch (sessionError) {
      logger.debug({ idTokenError, sessionError }, 'Failed to verify Firebase token');
      throw sessionError;
    }
  }
};

const mapToAuthenticatedUser = (
  decoded: DecodedIdToken,
  tokenType: AuthTokenType,
): AuthenticatedUser => ({
  uid: decoded.uid,
  email: decoded.email ?? undefined,
  name: decoded.name ?? undefined,
  picture: decoded.picture ?? undefined,
  claims: decoded,
  issuedAt: new Date(decoded.iat * 1000),
  expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : undefined,
  tokenType,
});

const attachActor = (
  req: Request,
  res: Response,
  authUser: AuthenticatedUser,
  token: string,
  source?: 'header' | 'cookie' | 'custom',
) => {
  req.authUser = authUser;
  req.authToken = token;
  req.authTokenSource = source;
  res.locals.authUser = authUser;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const { token, source } = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  void verifyAuthToken(token)
    .then(({ decoded, tokenType }) => {
      const authUser = mapToAuthenticatedUser(decoded, tokenType);
      attachActor(req, res, authUser, token, source);
      next();
    })
    .catch((error) => {
      logger.warn({ err: error }, 'Authorization token verification failed');
      res.status(401).json({ error: 'Invalid or expired authentication token' });
    });
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const { token, source } = extractToken(req);

  if (!token) {
    next();
    return;
  }

  void verifyAuthToken(token)
    .then(({ decoded, tokenType }) => {
      const authUser = mapToAuthenticatedUser(decoded, tokenType);
      attachActor(req, res, authUser, token, source);
    })
    .catch((error) => {
      logger.debug({ err: error }, 'Optional authentication token rejected');
    })
    .finally(() => {
      next();
    });
};

export const buildSessionCookieOptions = () => ({
  maxAge: appConfig.sessionMaxAgeMs,
  httpOnly: true,
  secure: appConfig.env !== 'development',
  sameSite: 'lax' as const,
  path: '/',
});

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthenticatedUser;
    authToken?: string;
    authTokenSource?: 'header' | 'cookie' | 'custom';
  }
}
