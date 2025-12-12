/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import type { Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  createSessionCookieStrict,
  revokeRefreshTokensStrict,
  verifyIdTokenStrict,
} from '../config/firebase';
import { appConfig } from '../config/env';
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from '../middleware/auth.middleware';
import { logger } from '../lib/logger';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

interface SessionRequest {
  idToken?: unknown;
  remember?: unknown;
}

const mapDecodedIdToken = (decoded: DecodedIdToken) => ({
  uid: decoded.uid,
  email: decoded.email ?? undefined,
  name: decoded.name ?? undefined,
  picture: decoded.picture ?? undefined,
  claims: { ...decoded },
  issuedAt: new Date(decoded.iat * 1000).toISOString(),
  expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined,
});

const resolveSessionDuration = (remember?: boolean): number => {
  const preferred =
    remember === true
      ? appConfig.sessionMaxAgeMs
      : Math.min(appConfig.sessionMaxAgeMs, ONE_DAY_IN_MS);
  return preferred;
};

export const createSession = async (req: Request, res: Response): Promise<void> => {
  const body: SessionRequest =
    typeof req.body === 'object' && req.body !== null ? (req.body as SessionRequest) : {};
  const rawToken = typeof body.idToken === 'string' ? body.idToken : undefined;
  const rememberFlag = typeof body.remember === 'boolean' ? body.remember : undefined;

  if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  const trimmedToken = rawToken.trim();

  try {
    const decoded = await verifyIdTokenStrict(trimmedToken, true);
    const expiresIn = resolveSessionDuration(rememberFlag);
    const sessionCookie = await createSessionCookieStrict(trimmedToken, { expiresIn });

    const cookieOptions = {
      ...buildSessionCookieOptions(),
      maxAge: expiresIn,
      secure: true,
      sameSite: 'lax' as const, // <--- 'lax' để trình duyệt dễ tính hơn
    };
    // ------------------------------------

    res.cookie(SESSION_COOKIE_NAME, sessionCookie, cookieOptions);
    res.status(201).json({
      sessionCookie,
      expiresAt: new Date(Date.now() + expiresIn).toISOString(),
      user: mapDecodedIdToken(decoded),
    });
  } catch (error) {
    logger.warn({ err: error }, 'Failed to create Firebase session cookie');
    res.status(401).json({ error: 'Invalid or expired identity token' });
  }
};

export const getCurrentUser = (req: Request, res: Response): void => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { authUser } = req;

  res.status(200).json({
    user: {
      uid: authUser.uid,
      email: authUser.email,
      name: authUser.name,
      picture: authUser.picture,
      tokenType: authUser.tokenType,
      issuedAt: authUser.issuedAt.toISOString(),
      expiresAt: authUser.expiresAt?.toISOString(),
      claims: authUser.claims,
    },
  });
};

export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    await revokeRefreshTokensStrict(req.authUser.uid);
    const { maxAge: _maxAge, ...baseOptions } = buildSessionCookieOptions();

    const cookieOptions = {
      ...baseOptions,
      secure: true,
      sameSite: 'lax' as const,
    };
    // ---------------------------------------------

    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Failed to revoke Firebase refresh tokens');
    res.status(500).json({ error: 'Unable to revoke session' });
  }
};
