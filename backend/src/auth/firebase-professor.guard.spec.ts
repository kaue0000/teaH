import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseProfessorGuard } from './firebase-professor.guard';

describe('FirebaseProfessorGuard', () => {
  const verifyIdToken = jest.fn<Auth['verifyIdToken']>();
  const auth = { verifyIdToken } as unknown as Auth;
  const guard = new FirebaseProfessorGuard(auth);

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

  it('valida o token revogado e anexa a identidade do professor', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'professor-uid',
      email: 'professor@example.com',
      name: 'Professor',
      papel: 'PROFESSOR',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context, request } = criarContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', true);
    expect(request).toHaveProperty('professor', {
      uid: 'professor-uid',
      email: 'professor@example.com',
      nome: 'Professor',
    });
  });

  it('recusa requisições sem bearer token', async () => {
    const { context } = criarContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('recusa tokens válidos sem o papel de professor', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'student-uid',
      email: 'student@example.com',
      papel: 'ALUNO',
    } as Awaited<ReturnType<Auth['verifyIdToken']>>);
    const { context } = criarContext('Bearer student-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('converte tokens inválidos em resposta não autenticada', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));
    const { context } = criarContext('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
