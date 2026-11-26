import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { AuthenticatedAluno } from '../../auth/firebase-aluno.guard';
import type { AuthenticatedProfessor } from '../../auth/firebase-professor.guard';
import { PostgresService } from '../../database/postgres.service';
import type { SugestaoRespostaResultado } from './sugestao-resposta.service';
import { RevisaoDecisao } from './revisao-decisao';
import type { RevisarSugestaoDto } from './dto/revisar-sugestao.dto';
import { UserRole } from '../../auth/user-role';

interface IdRow {
  id: string;
}

interface SuggestionRow {
  sugestao_original: string;
}

interface MessageRow {
  id: string;
  status: 'aberto' | 'respondido';
}

export interface ChamadoPendente {
  mensagemId: string;
  sugestaoId: string;
  texto: string;
  rascunho: string;
  criadoEm: Date;
  alunoNome: string | null;
  serie: string | null;
}

@Injectable()
export class RevisaoSugestaoService {
  constructor(private readonly postgres: PostgresService) {}

  async listarPendentes(professor: AuthenticatedProfessor) {
    return this.postgres.transaction(async (client) => {
      const usuarioId = await this.obterUsuarioId(
        client,
        professor,
        UserRole.PROFESSOR,
      );
      const chamados = await client.query<ChamadoPendente>(
        `SELECT
           mensagem.id AS "mensagemId",
           sugestao.id AS "sugestaoId",
           mensagem.conteudo_mascarado AS texto,
           sugestao.sugestao_original AS rascunho,
           mensagem.criado_em AS "criadoEm",
           CASE WHEN aluno.papel = 'aluno' THEN aluno.nome END AS "alunoNome",
           CASE WHEN aluno.papel = 'aluno' THEN aluno.serie END AS serie
         FROM mensagens AS mensagem
         JOIN usuarios AS aluno ON aluno.id = mensagem.usuario_id
         JOIN LATERAL (
           SELECT id, sugestao_original
           FROM sugestoes
           WHERE mensagem_id = mensagem.id
           ORDER BY id DESC
           LIMIT 1
         ) AS sugestao ON TRUE
         WHERE mensagem.professor_id = $1 AND mensagem.status = 'aberto'
         ORDER BY mensagem.criado_em ASC`,
        [usuarioId],
      );
      return chamados.rows;
    });
  }

  async registrarSugestao(
    resultado: SugestaoRespostaResultado,
    professor: AuthenticatedProfessor,
    mensagemId?: string,
    aluno?: AuthenticatedAluno,
  ): Promise<{ mensagemId: string; sugestaoId: string }> {
    return this.postgres.transaction(async (client) => {
      const professorId = await this.obterUsuarioId(
        client,
        professor,
        UserRole.PROFESSOR,
      );
      const remetenteId = aluno
        ? await this.obterUsuarioId(client, aluno, UserRole.ALUNO, aluno.serie)
        : professorId;
      let idMensagem: string;

      if (mensagemId) {
        const mensagem = await client.query<MessageRow>(
          `SELECT id, status
           FROM mensagens
           WHERE id = $1 AND professor_id = $2
           FOR UPDATE`,
          [mensagemId, professorId],
        );
        if (!mensagem.rowCount) {
          throw new NotFoundException('Mensagem não encontrada.');
        }
        if (mensagem.rows[0].status === 'respondido') {
          throw new ConflictException(
            'O atendimento já foi marcado como respondido.',
          );
        }
        idMensagem = mensagem.rows[0].id;
      } else {
        const mensagem = await client.query<IdRow>(
          `INSERT INTO mensagens (usuario_id, professor_id, conteudo_mascarado)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [remetenteId, professorId, resultado.texto],
        );
        idMensagem = mensagem.rows[0].id;
      }

      const [nomeModelo, ...versaoModelo] = resultado.modelo.split(':');
      const modelo = await client.query<IdRow>(
        `INSERT INTO modelos_ia (nome, versao)
         VALUES ($1, $2)
         ON CONFLICT (nome, versao) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id`,
        [nomeModelo, versaoModelo.join(':') || 'desconhecida'],
      );
      const sugestao = await client.query<IdRow>(
        `INSERT INTO sugestoes (mensagem_id, modelo_ia_id, sugestao_original)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [idMensagem, modelo.rows[0].id, resultado.rascunho],
      );

      return {
        mensagemId: idMensagem,
        sugestaoId: sugestao.rows[0].id,
      };
    });
  }

  async revisar(dto: RevisarSugestaoDto, professor: AuthenticatedProfessor) {
    if (dto.decisao !== RevisaoDecisao.MANUAL && !dto.sugestaoId) {
      throw new BadRequestException('Informe a sugestão que deseja revisar.');
    }

    return this.postgres.transaction(async (client) => {
      const usuarioId = await this.obterUsuarioId(
        client,
        professor,
        UserRole.PROFESSOR,
      );
      const mensagem = await client.query<MessageRow>(
        `SELECT id, status
         FROM mensagens
         WHERE id = $1 AND professor_id = $2
         FOR UPDATE`,
        [dto.mensagemId, usuarioId],
      );
      if (!mensagem.rowCount) {
        throw new NotFoundException('Mensagem não encontrada.');
      }
      if (mensagem.rows[0].status === 'respondido') {
        throw new ConflictException(
          'O atendimento já foi marcado como respondido.',
        );
      }

      let sugestaoId: string | null = null;
      let textoFinal: string | null = null;
      if (dto.sugestaoId) {
        const sugestao = await client.query<SuggestionRow>(
          `SELECT sugestao_original
           FROM sugestoes
           WHERE id = $1 AND mensagem_id = $2
           FOR UPDATE`,
          [dto.sugestaoId, dto.mensagemId],
        );
        if (!sugestao.rowCount) {
          throw new NotFoundException('Sugestão não encontrada.');
        }
        sugestaoId = dto.sugestaoId;

        if (dto.decisao === RevisaoDecisao.ACEITA) {
          textoFinal = sugestao.rows[0].sugestao_original;
        }
      }

      if (
        dto.decisao === RevisaoDecisao.EDITADA ||
        dto.decisao === RevisaoDecisao.MANUAL
      ) {
        textoFinal = dto.textoFinal?.trim() || null;
      }

      const revisao = await client.query<IdRow>(
        `INSERT INTO revisoes
           (mensagem_id, sugestao_id, usuario_id, decisao, texto_final, justificativa)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          dto.mensagemId,
          sugestaoId,
          usuarioId,
          dto.decisao,
          textoFinal,
          dto.decisao === RevisaoDecisao.REJEITADA
            ? dto.justificativa?.trim()
            : null,
        ],
      );

      if (dto.decisao !== RevisaoDecisao.REJEITADA) {
        await client.query(
          `UPDATE mensagens SET status = 'respondido' WHERE id = $1`,
          [dto.mensagemId],
        );
      }

      return {
        revisaoId: revisao.rows[0].id,
        mensagemId: dto.mensagemId,
        sugestaoId,
        decisao: dto.decisao,
        textoFinal,
        justificativa:
          dto.decisao === RevisaoDecisao.REJEITADA
            ? dto.justificativa?.trim()
            : null,
      };
    });
  }

  private async obterUsuarioId(
    client: PoolClient,
    perfil: AuthenticatedProfessor | AuthenticatedAluno,
    papel: UserRole,
    serie?: string,
  ): Promise<string> {
    const resultado = await client.query<IdRow>(
      `INSERT INTO usuarios (papel, nome, email, firebase_uid, serie)
       VALUES ($1::usuario_papel, $2, $3, $4, $5)
       ON CONFLICT (firebase_uid) DO UPDATE
         SET papel = EXCLUDED.papel,
             nome = EXCLUDED.nome,
             email = EXCLUDED.email,
             serie = EXCLUDED.serie,
             atualizado_em = NOW()
       RETURNING id`,
      [
        papel === UserRole.PROFESSOR ? 'professor' : 'aluno',
        perfil.nome,
        perfil.email,
        perfil.uid,
        serie ?? null,
      ],
    );
    return resultado.rows[0].id;
  }
}
