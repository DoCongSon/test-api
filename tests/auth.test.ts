import type { DecodedIdToken } from 'firebase-admin/auth';
import request from 'supertest';
import { app } from '../src/app';
import {
  createSessionCookieStrict,
  firebaseAuth,
  revokeRefreshTokensStrict,
  verifyIdTokenStrict,
  verifySessionCookieStrict,
} from '../src/config/firebase';

jest.mock('../src/config/firebase', () => {
  const verifyIdToken = jest.fn();
  const verifySessionCookie = jest.fn();
  const createSessionCookie = jest.fn();
  const revokeRefreshTokens = jest.fn();

  return {
    firebaseAuth: {
      verifyIdToken,
      verifySessionCookie,
      createSessionCookie,
      revokeRefreshTokens,
    },
    verifyIdTokenStrict: verifyIdToken,
    verifySessionCookieStrict: verifySessionCookie,
    createSessionCookieStrict: createSessionCookie,
    revokeRefreshTokensStrict: revokeRefreshTokens,
  };
});

const mockedAuth = firebaseAuth as unknown as {
  verifyIdToken: jest.Mock;
  verifySessionCookie: jest.Mock;
  createSessionCookie: jest.Mock;
  revokeRefreshTokens: jest.Mock;
};
const mockedVerifyIdToken = verifyIdTokenStrict as unknown as jest.Mock;
const mockedVerifySessionCookie = verifySessionCookieStrict as unknown as jest.Mock;
const mockedCreateSessionCookie = createSessionCookieStrict as unknown as jest.Mock;
const mockedRevokeRefreshTokens = revokeRefreshTokensStrict as unknown as jest.Mock;

const buildDecodedToken = (overrides: Partial<DecodedIdToken> = {}): DecodedIdToken => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    uid: 'user-123',
    aud: 'test-project',
    iss: 'https://securetoken.google.com/test-project',
    sub: 'user-123',
    auth_time: nowSeconds,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    firebase: {
      identities: {},
      sign_in_provider: 'custom',
    },
    email: 'user@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.png',
    ...overrides,
  } as DecodedIdToken;
};

beforeEach(() => {
  mockedAuth.verifyIdToken.mockReset();
  mockedAuth.verifySessionCookie.mockReset();
  mockedAuth.createSessionCookie.mockReset();
  mockedAuth.revokeRefreshTokens.mockReset();
  mockedVerifyIdToken.mockReset();
  mockedVerifySessionCookie.mockReset();
  mockedCreateSessionCookie.mockReset();
  mockedRevokeRefreshTokens.mockReset();
});

describe('Authentication middleware', () => {
  it('rejects access to protected routes without credentials', async () => {
    const response = await request(app).get('/hello/secure');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
  });

  it('allows access to protected routes with a verified ID token', async () => {
    const decodedToken = buildDecodedToken();
    mockedAuth.verifyIdToken.mockResolvedValue(decodedToken);
    mockedVerifyIdToken.mockResolvedValue(decodedToken);

    const response = await request(app)
      .get('/hello/secure')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ message: 'Hello, Test User!', uid: 'user-123' });
    expect(mockedVerifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });
});

describe('Authentication endpoints', () => {
  it('creates a session cookie from an ID token', async () => {
    const decodedToken = buildDecodedToken();
    mockedAuth.verifyIdToken.mockResolvedValue(decodedToken);
    mockedVerifyIdToken.mockResolvedValue(decodedToken);
    mockedAuth.createSessionCookie.mockResolvedValue('session-cookie');
    mockedCreateSessionCookie.mockResolvedValue('session-cookie');

    const response = await request(app)
      .post('/auth/session')
      .send({ idToken: 'id-token', remember: true });

    expect(response.status).toBe(201);
    const body = response.body as {
      sessionCookie: string;
      user: { uid: string; email?: string };
    };

    expect(body.sessionCookie).toBe('session-cookie');
    expect(body.user).toMatchObject({ uid: 'user-123', email: 'user@example.com' });
    expect(mockedVerifyIdToken).toHaveBeenCalledWith('id-token', true);
    expect(mockedCreateSessionCookie).toHaveBeenCalled();
  });

  it('revokes refresh tokens for the authenticated session', async () => {
    const decodedToken = buildDecodedToken();
    mockedAuth.verifyIdToken.mockResolvedValue(decodedToken);
    mockedVerifyIdToken.mockResolvedValue(decodedToken);

    const response = await request(app)
      .delete('/auth/session')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(204);
    expect(mockedRevokeRefreshTokens).toHaveBeenCalledWith('user-123');
  });

  it('returns the current authenticated user profile', async () => {
    const decodedToken = buildDecodedToken();
    mockedAuth.verifyIdToken.mockResolvedValue(decodedToken);
    mockedVerifyIdToken.mockResolvedValue(decodedToken);

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer profile-token');

    expect(response.status).toBe(200);
    const body = response.body as {
      user: { uid: string; tokenType: string };
    };

    expect(body.user.uid).toBe('user-123');
    expect(body.user.tokenType).toBe('id');
  });
});
