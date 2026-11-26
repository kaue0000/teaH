import { Module } from '@nestjs/common';
import { FirebaseAuthModule } from '../auth/firebase-auth.module';
import { ProfessoresController } from './professores.controller';
import { ProfessoresService } from './professores.service';

@Module({
  imports: [FirebaseAuthModule],
  controllers: [ProfessoresController],
  providers: [ProfessoresService],
  exports: [ProfessoresService],
})
export class ProfessoresModule {}
