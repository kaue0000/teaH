import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseAlunoGuard } from './firebase-aluno.guard';

describe('FirebaseAlunoGuard', () => {
  const verifyIdToken = jest.fn<Auth['verifyIdToken']>();
  const auth = { verifyIdToken } as unknown as Auth;
  const guard = new FirebaseAlunoGuard(auth);

  function criarContext(authorization?: string) {
    const request = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it('extrai a identidade do perfil confiável do Firebase', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'student-uid',
      email: 'student@example.com',
      name: 'Aluno de teste',
      papel: 'ALUNO',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context, request } = criarContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', true);
    expect(request).toHaveProperty('aluno', {
      uid: 'student-uid',
      email: 'student@example.com',
      nome: 'Aluno de teste',
    });
  });

  it('nega tokens sem papel de aluno', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'teacher-uid',
      email: 'teacher@example.com',
      papel: 'PROFESSOR',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context } = criarContext('Bearer teacher-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('nega requisições sem token', async () => {
    const { context } = criarContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
