import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const firebaseAuthMock = {
    createUser: jest.fn<Auth['createUser']>(),
    verifyIdToken: jest.fn<Auth['verifyIdToken']>(),
    revokeRefreshTokens: jest.fn<Auth['revokeRefreshTokens']>(),
  };
  const firebaseAuth = firebaseAuthMock as unknown as Auth;
  const config = {
    get: jest.fn(() => 'firebase-api-key'),
  } as unknown as ConfigService;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(firebaseAuth, config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a Firebase user and returns only public profile fields', async () => {
    firebaseAuthMock.createUser.mockResolvedValue({
      uid: 'user-id',
      email: 'user@example.com',
      displayName: 'Test User',
    } as Awaited<ReturnType<Auth['createUser']>>);

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'secure-password',
        displayName: 'Test User',
      }),
    ).resolves.toEqual({
      uid: 'user-id',
      email: 'user@example.com',
      displayName: 'Test User',
    });
  });

  it('does not expose Firebase credential details when permissions are missing', async () => {
    firebaseAuthMock.createUser.mockRejectedValue(
      Object.assign(new Error('sensitive credential details'), {
        code: 'auth/insufficient-permission',
      }),
    );

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'secure-password',
      }),
    ).rejects.toMatchObject({
      status: 503,
      message:
        'A conta de serviço do Firebase não tem permissão para cadastrar usuários.',
    });
  });

  it('returns Firebase sign-in tokens when credentials are valid', async () => {
    const signInResponse = {
      localId: 'user-id',
      email: 'user@example.com',
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: '3600',
    };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(signInResponse)));

    await expect(
      service.login({ email: 'user@example.com', password: 'password' }),
    ).resolves.toEqual(signInResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('accounts:signInWithPassword'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects invalid login credentials', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'INVALID_PASSWORD' } }), {
        status: 400,
      }),
    );

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('reports Firebase login configuration errors as unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'OPERATION_NOT_ALLOWED' } }),
        { status: 400 },
      ),
    );

    await expect(
      service.login({ email: 'user@example.com', password: 'password' }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('returns a gateway error for unknown Firebase login responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'UNEXPECTED_FIREBASE_ERROR' } }),
        { status: 400 },
      ),
    );

    await expect(
      service.login({ email: 'user@example.com', password: 'password' }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('revokes refresh tokens for the authenticated user on logout', async () => {
    firebaseAuthMock.verifyIdToken.mockResolvedValue({
      uid: 'user-id',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    firebaseAuthMock.revokeRefreshTokens.mockResolvedValue();

    await expect(service.logout('id-token')).resolves.toEqual({
      message: 'Sessão encerrada.',
    });
    expect(firebaseAuthMock.verifyIdToken).toHaveBeenCalledWith('id-token');
    expect(firebaseAuthMock.revokeRefreshTokens).toHaveBeenCalledWith(
      'user-id',
    );
  });
});
