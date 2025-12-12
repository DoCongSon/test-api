/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import admin, { app, auth } from 'firebase-admin';
import { logger } from '../lib/logger';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const hasServiceAccount =
  typeof serviceAccount.projectId === 'string' &&
  serviceAccount.projectId.length > 0 &&
  typeof serviceAccount.clientEmail === 'string' &&
  serviceAccount.clientEmail.length > 0 &&
  typeof serviceAccount.privateKey === 'string' &&
  serviceAccount.privateKey.length > 0;

const initializeFirebaseApp = (): app.App => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    if (hasServiceAccount) {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        projectId: serviceAccount.projectId,
      });
    }

    logger.warn(
      'Firebase service account details missing; attempting to initialise using application default credentials.',
    );
    return admin.initializeApp();
  } catch (error) {
    logger.error({ error }, 'Failed to initialise Firebase Admin SDK');
    throw error;
  }
};

export const firebaseApp: app.App = initializeFirebaseApp();
export const firebaseAuth: auth.Auth = firebaseApp.auth();

export const verifyIdTokenStrict = (
  token: string,
  checkRevoked = true,
): Promise<auth.DecodedIdToken> => firebaseAuth.verifyIdToken(token, checkRevoked);

export const verifySessionCookieStrict = (
  sessionCookie: string,
  checkRevoked = true,
): Promise<auth.DecodedIdToken> => firebaseAuth.verifySessionCookie(sessionCookie, checkRevoked);

export const createSessionCookieStrict = (
  idToken: string,
  options: auth.SessionCookieOptions,
): Promise<string> => firebaseAuth.createSessionCookie(idToken, options);

export const revokeRefreshTokensStrict = (uid: string): Promise<void> =>
  firebaseAuth.revokeRefreshTokens(uid);
