import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAuthModule } from './firebase-auth.module';

@Module({
  imports: [ConfigModule, FirebaseAuthModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
