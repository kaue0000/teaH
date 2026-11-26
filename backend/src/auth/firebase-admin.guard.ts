import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from './firebase-auth.constants';

@Injectable()
export class FirebaseAdminGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
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

    const adminUids = this.config
      .get<string>('ADMIN_UIDS', '')
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean);
    if (!adminUids.length) {
      throw new ServiceUnavailableException(
        'Nenhum administrador está configurado.',
      );
    }
    if (!adminUids.includes(token.uid)) {
      throw new ForbiddenException(
        'Apenas administradores podem realizar esta ação.',
      );
    }

    return true;
  }
}
