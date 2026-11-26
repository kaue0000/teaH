import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Auth, UserRecord } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from '../auth/firebase-auth.constants';
import { UserRole } from '../auth/user-role';
import type { AuthenticatedProfessor } from '../auth/firebase-professor.guard';

export interface ProfessorPublico {
  id: string;
  nome: string;
}

@Injectable()
export class ProfessoresService {
  constructor(@Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth) {}

  async listar(): Promise<ProfessorPublico[]> {
    const professores: ProfessorPublico[] = [];
    let pageToken: string | undefined;

    do {
      let resultado;
      try {
        resultado = await this.firebaseAuth.listUsers(1000, pageToken);
      } catch {
        throw new ServiceUnavailableException(
          'Não foi possível carregar a lista de professores.',
        );
      }

      professores.push(
        ...resultado.users.filter(this.ehProfessorAtivo).map((usuario) => ({
          id: usuario.uid,
          nome: usuario.displayName?.trim() || 'Professor',
        })),
      );
      pageToken = resultado.pageToken;
    } while (pageToken);

    return professores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async obterPorId(id: string): Promise<AuthenticatedProfessor> {
    let usuario: UserRecord;
    try {
      usuario = await this.firebaseAuth.getUser(id);
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : undefined;
      if (code === 'auth/user-not-found') {
        throw new NotFoundException('Professor não encontrado.');
      }
      throw new ServiceUnavailableException(
        'Não foi possível validar o professor selecionado.',
      );
    }

    if (!this.ehProfessorAtivo(usuario) || !usuario.email) {
      throw new NotFoundException('Professor não encontrado.');
    }

    return {
      uid: usuario.uid,
      email: usuario.email,
      nome: usuario.displayName?.trim() || usuario.email,
    };
  }

  private readonly ehProfessorAtivo = (usuario: UserRecord): boolean =>
    !usuario.disabled &&
    Boolean(usuario.email) &&
    usuario.customClaims?.papel === UserRole.PROFESSOR;
}
