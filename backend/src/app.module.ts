import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChamadosModule } from './chamados/chamados.module';
import { SugestaoRespostaModule } from './chamados/sugestao-resposta/sugestao-resposta.module';
import { IaModule } from './ia/ia.module';
import { ProfessoresModule } from './professores/professores.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    IaModule,
    ChamadosModule,
    SugestaoRespostaModule,
    ProfessoresModule,
  ],
})
export class AppModule {}
