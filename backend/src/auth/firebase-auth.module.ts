import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { FIREBASE_AUTH } from './firebase-auth.constants';
import { FirebaseAdminGuard } from './firebase-admin.guard';
import { FirebaseAlunoGuard } from './firebase-aluno.guard';
import { FirebaseProfessorGuard } from './firebase-professor.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FIREBASE_AUTH,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const serviceAccountPath = resolve(
          process.cwd(),
          config.get('FIREBASE_SERVICE_ACCOUNT_PATH', 'serviceAccount.json'),
        );
        const serviceAccount = JSON.parse(
          readFileSync(serviceAccountPath, 'utf8'),
        ) as ServiceAccount;
        const appName = 'teah-auth';
        const app =
          getApps().find((registeredApp) => registeredApp.name === appName) ??
          initializeApp(
            {
              credential: cert(serviceAccount),
              projectId: serviceAccount.projectId,
            },
            appName,
          );

        const { getAuth } = await import('firebase-admin/auth');
        return getAuth(app);
      },
    },
    FirebaseAdminGuard,
    FirebaseAlunoGuard,
    FirebaseProfessorGuard,
  ],
  exports: [
    FIREBASE_AUTH,
    FirebaseAdminGuard,
    FirebaseAlunoGuard,
    FirebaseProfessorGuard,
  ],
})
export class FirebaseAuthModule {}
