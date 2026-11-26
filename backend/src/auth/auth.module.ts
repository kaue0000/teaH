import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FIREBASE_AUTH } from './firebase-auth.constants';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    {
      provide: FIREBASE_AUTH,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
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

        return getAuth(app);
      },
    },
    AuthService,
  ],
})
export class AuthModule {}
