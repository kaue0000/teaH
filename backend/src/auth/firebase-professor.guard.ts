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

export interface AuthenticatedProfessor {
  uid: string;
  email: string;
  nome: string;
}

export type ProfessorRequest = Request & {
  professor: AuthenticatedProfessor;
};

function isProfessorToken(token: DecodedIdToken): boolean {
  return token.papel === UserRole.PROFESSOR;
}

@Injectable()
export class FirebaseProfessorGuard implements CanActivate {
  constructor(@Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProfessorRequest>();
    const authorization = request.headers.authorization;
    const parts = authorization?.split(' ') ?? [];

    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    let token: DecodedIdToken;
    try {
      token = await this.firebaseAuth.verifyIdToken(parts[1], true);
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    if (!isProfessorToken(token)) {
      throw new ForbiddenException(
        'Apenas professores podem realizar esta ação.',
      );
    }

    if (!token.email) {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    request.professor = {
      uid: token.uid,
      email: token.email,
      nome: typeof token.name === 'string' ? token.name : token.email,
    };

    return true;
  }
}
