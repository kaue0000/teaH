import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseAdminGuard } from './firebase-admin.guard';

describe('FirebaseAdminGuard', () => {
  const verifyIdToken = jest.fn<Auth['verifyIdToken']>();
  const auth = { verifyIdToken } as unknown as Auth;
  const getConfig = jest.fn(() => 'configured-admin-uid');
  const config = {
    get: getConfig,
  } as unknown as ConfigService;
  const guard = new FirebaseAdminGuard(auth, config);

  function criarContext(authorization?: string) {
    const request = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context };
  }

  beforeEach(() => {
    verifyIdToken.mockReset();
    getConfig.mockReturnValue('configured-admin-uid');
  });

  it('permits a valid token whose UID is configured as administrator', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'configured-admin-uid',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context } = criarContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });

  it('rejects requests without a bearer token', async () => {
    const { context } = criarContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects valid users not listed in administrator configuration', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'student-uid',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context } = criarContext('Bearer valid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reports missing administrator configuration', async () => {
    getConfig.mockReturnValue('');
    verifyIdToken.mockResolvedValue({
      uid: 'student-uid',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context } = criarContext('Bearer valid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
