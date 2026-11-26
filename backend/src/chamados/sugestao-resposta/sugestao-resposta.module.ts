import { Module } from '@nestjs/common';
import { FirebaseAuthModule } from '../../auth/firebase-auth.module';
import { DatabaseModule } from '../../database/database.module';
import { IaModule } from '../../ia/ia.module';
import { ProfessoresModule } from '../../professores/professores.module';
import { SugestaoRespostaController } from './sugestao-resposta.controller';
import { RevisaoSugestaoService } from './revisao-sugestao.service';
import { SugestaoRespostaService } from './sugestao-resposta.service';

@Module({
  imports: [IaModule, FirebaseAuthModule, DatabaseModule, ProfessoresModule],
  controllers: [SugestaoRespostaController],
  providers: [SugestaoRespostaService, RevisaoSugestaoService],
})
export class SugestaoRespostaModule {}
