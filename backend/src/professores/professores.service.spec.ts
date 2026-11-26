import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Auth } from 'firebase-admin/auth';
import { ProfessoresService } from './professores.service';

describe('ProfessoresService', () => {
  const listUsers = jest.fn<Auth['listUsers']>();
  const getUser = jest.fn<Auth['getUser']>();
  const auth = { listUsers, getUser } as unknown as Auth;
  let service: ProfessoresService;

  beforeEach(() => {
    listUsers.mockReset();
    getUser.mockReset();
    service = new ProfessoresService(auth);
  });

  it('lista apenas professores ativos e retorna nome e ID público', async () => {
    listUsers.mockResolvedValue({
      users: [
        {
          uid: 'teacher-b',
          displayName: 'Beatriz',
          email: 'beatriz@example.com',
          disabled: false,
          customClaims: { papel: 'PROFESSOR' },
        },
        {
          uid: 'student',
          displayName: 'Aluno',
          email: 'aluno@example.com',
          disabled: false,
          customClaims: { papel: 'ALUNO' },
        },
        {
          uid: 'teacher-disabled',
          displayName: 'Professor inativo',
          email: 'inativo@example.com',
          disabled: true,
          customClaims: { papel: 'PROFESSOR' },
        },
        {
          uid: 'teacher-a',
          displayName: 'Ana',
          email: 'ana@example.com',
          disabled: false,
          customClaims: { papel: 'PROFESSOR' },
        },
      ] as Awaited<ReturnType<Auth['listUsers']>>['users'],
      pageToken: undefined,
    });

    await expect(service.listar()).resolves.toEqual([
      { id: 'teacher-a', nome: 'Ana' },
      { id: 'teacher-b', nome: 'Beatriz' },
    ]);
  });

  it('valida por Firebase UID que o professor selecionado está ativo', async () => {
    getUser.mockResolvedValue({
      uid: 'teacher-id',
      email: 'teacher@example.com',
      displayName: 'Professor',
      disabled: false,
      customClaims: { papel: 'PROFESSOR' },
    } as Awaited<ReturnType<Auth['getUser']>>);

    await expect(service.obterPorId('teacher-id')).resolves.toEqual({
      uid: 'teacher-id',
      email: 'teacher@example.com',
      nome: 'Professor',
    });
  });

  it('não permite selecionar conta que não seja professor ativo', async () => {
    getUser.mockResolvedValue({
      uid: 'student-id',
      email: 'student@example.com',
      disabled: false,
      customClaims: { papel: 'ALUNO' },
    } as Awaited<ReturnType<Auth['getUser']>>);

    await expect(service.obterPorId('student-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
