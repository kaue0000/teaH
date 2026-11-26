import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from './firebase-auth.constants';
import { UserRole } from './user-role';

export interface AuthenticatedAluno {
  uid: string;
  email: string;
  nome: string;
  serie: string;
}

export type AlunoRequest = Request & {
  aluno: AuthenticatedAluno;
};

function isAlunoToken(token: DecodedIdToken): token is DecodedIdToken & {
  serie: string;
} {
  return (
    token.papel === UserRole.ALUNO &&
    typeof token.serie === 'string' &&
    Boolean(token.serie.trim())
  );
}

@Injectable()
export class FirebaseAlunoGuard implements CanActivate {
  constructor(@Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AlunoRequest>();
    const parts = request.headers.authorization?.split(' ') ?? [];
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    let token: DecodedIdToken;
    try {
      token = await this.firebaseAuth.verifyIdToken(parts[1], true);
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    if (!isAlunoToken(token)) {
      throw new ForbiddenException(
        'Apenas alunos autenticados podem enviar chamados.',
      );
    }
    if (!token.email) {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    request.aluno = {
      uid: token.uid,
      email: token.email,
      nome: typeof token.name === 'string' ? token.name : token.email,
      serie: token.serie.trim(),
    };
    return true;
  }
}
