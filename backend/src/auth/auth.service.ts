import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { FIREBASE_AUTH } from './firebase-auth.constants';

export interface FirebaseSignInResponse {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface FirebaseErrorResponse {
  error?: {
    message?: string;
  };
}

@Injectable()
export class AuthService {
  private readonly apiKey: string;

  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('FIREBASE_API_KEY');
    if (!apiKey) {
      throw new Error('FIREBASE_API_KEY must be configured.');
    }

    this.apiKey = apiKey;
  }

  async register(dto: RegisterDto) {
    try {
      const user = await this.firebaseAuth.createUser({
        email: dto.email,
        password: dto.password,
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
      });

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      };
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : undefined;
      if (code === 'auth/email-already-exists') {
        throw new ConflictException('Já existe uma conta com este e-mail.');
      }
      if (
        code === 'auth/invalid-email' ||
        code === 'auth/invalid-password' ||
        code === 'auth/invalid-display-name'
      ) {
        throw new BadRequestException(
          'Os dados informados para cadastro são inválidos.',
        );
      }
      if (code === 'auth/insufficient-permission') {
        throw new ServiceUnavailableException(
          'A conta de serviço do Firebase não tem permissão para cadastrar usuários.',
        );
      }

      throw new InternalServerErrorException(
        'Não foi possível concluir o cadastro no Firebase.',
      );
    }
  }

  async login(dto: LoginDto): Promise<FirebaseSignInResponse> {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: dto.email,
          password: dto.password,
          returnSecureToken: true,
        }),
      },
    );

    if (!response.ok) {
      const result = (await response.json()) as FirebaseErrorResponse;
      const code = result.error?.message;

      if (
        code === 'EMAIL_NOT_FOUND' ||
        code === 'INVALID_PASSWORD' ||
        code === 'INVALID_LOGIN_CREDENTIALS' ||
        code === 'USER_DISABLED'
      ) {
        throw new UnauthorizedException('E-mail ou senha inválidos.');
      }
      if (code === 'INVALID_EMAIL' || code === 'MISSING_PASSWORD') {
        throw new BadRequestException(
          'Os dados informados para entrar são inválidos.',
        );
      }
      if (code === 'API_KEY_INVALID' || code === 'PROJECT_NOT_FOUND') {
        throw new ServiceUnavailableException(
          'A autenticação do Firebase não está configurada corretamente.',
        );
      }

      throw new InternalServerErrorException(
        'O Firebase não conseguiu concluir a solicitação de autenticação.',
      );
    }

    return (await response.json()) as FirebaseSignInResponse;
  }

  async logout(idToken: string): Promise<{ message: string }> {
    const decodedToken = await this.firebaseAuth.verifyIdToken(idToken);
    await this.firebaseAuth.revokeRefreshTokens(decodedToken.uid);

    return { message: 'Sessão encerrada.' };
  }
}
