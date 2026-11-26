import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { AlunoRequest } from '../../auth/firebase-aluno.guard';
import { FirebaseAlunoGuard } from '../../auth/firebase-aluno.guard';
import type { ProfessorRequest } from '../../auth/firebase-professor.guard';
import { FirebaseProfessorGuard } from '../../auth/firebase-professor.guard';
import { ProfessoresService } from '../../professores/professores.service';
import { EnviarChamadoDto } from './dto/enviar-chamado.dto';
import { RevisarSugestaoDto } from './dto/revisar-sugestao.dto';
import { SugerirRespostaDto } from './dto/sugerir-resposta.dto';
import { RevisaoSugestaoService } from './revisao-sugestao.service';
import { SugestaoRespostaService } from './sugestao-resposta.service';

const INTERCEPTAR_ARQUIVO = FileInterceptor('arquivo', {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

@Controller('chamados')
export class SugestaoRespostaController {
  constructor(
    private readonly sugestaoResposta: SugestaoRespostaService,
    private readonly revisaoSugestao: RevisaoSugestaoService,
    private readonly professores: ProfessoresService,
  ) {}

  @Get('meus')
  @UseGuards(FirebaseAlunoGuard)
  listarMeusChamados(@Req() request: AlunoRequest) {
    return this.revisaoSugestao.listarChamadosDoAluno(request.aluno);
  }

  @Get('pendentes')
  @UseGuards(FirebaseProfessorGuard)
  listarPendentes(@Req() request: ProfessorRequest) {
    return this.revisaoSugestao.listarPendentes(request.professor);
  }

  @Post('sugerir-resposta')
  @HttpCode(200)
  @UseGuards(FirebaseProfessorGuard)
  @UseInterceptors(INTERCEPTAR_ARQUIVO)
  async sugerirResposta(
    @Body() dto: SugerirRespostaDto,
    @Req() request: ProfessorRequest,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    const resultado = await this.sugestaoResposta.sugerirResposta(
      dto.texto,
      arquivo,
    );
    const ids = await this.revisaoSugestao.registrarSugestao(
      resultado,
      request.professor,
      dto.mensagemId,
    );
    return { ...resultado, ...ids };
  }

  @Post('enviar')
  @HttpCode(200)
  @UseGuards(FirebaseAlunoGuard)
  @UseInterceptors(INTERCEPTAR_ARQUIVO)
  async enviarChamado(
    @Body() dto: EnviarChamadoDto,
    @Req() request: AlunoRequest,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    const professor = await this.professores.obterPorId(dto.professorId);
    const resultado = await this.sugestaoResposta.sugerirResposta(
      dto.texto,
      arquivo,
    );
    const ids = await this.revisaoSugestao.registrarSugestao(
      resultado,
      professor,
      undefined,
      request.aluno,
    );
    return {
      ...ids,
      status: 'AGUARDANDO_REVISAO',
    };
  }

  @Post('revisar-sugestao')
  @HttpCode(200)
  @UseGuards(FirebaseProfessorGuard)
  revisarSugestao(
    @Body() dto: RevisarSugestaoDto,
    @Req() request: ProfessorRequest,
  ) {
    return this.revisaoSugestao.revisar(dto, request.professor);
  }
}
