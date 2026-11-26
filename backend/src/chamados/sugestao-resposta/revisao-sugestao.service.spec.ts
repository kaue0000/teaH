import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import type { AuthenticatedAluno } from '../../auth/firebase-aluno.guard';
import { PostgresService } from '../../database/postgres.service';
import type { AuthenticatedProfessor } from '../../auth/firebase-professor.guard';
import { RevisaoDecisao } from './revisao-decisao';
import type { RevisarSugestaoDto } from './dto/revisar-sugestao.dto';
import { RevisaoSugestaoService } from './revisao-sugestao.service';

describe('RevisaoSugestaoService', () => {
  const professor: AuthenticatedProfessor = {
    uid: 'firebase-uid',
    email: 'professor@example.com',
    nome: 'Professor',
  };
  const aluno: AuthenticatedAluno = {
    uid: 'student-uid',
    email: 'student@example.com',
    nome: 'Aluno de teste',
  };

  function criarService(resultados: object[][]) {
    const query = jest.fn(async () => {
      const rows = resultados.shift() ?? [];
      return { rows, rowCount: rows.length };
    });
    const postgres = {
      transaction: <T>(operation: (client: PoolClient) => Promise<T>) =>
        operation({ query } as unknown as PoolClient),
    } as unknown as PostgresService;

    return { service: new RevisaoSugestaoService(postgres), query };
  }

  it('lista apenas chamados pendentes vinculados ao professor autenticado', async () => {
    const pendentes = [
      {
        mensagemId: '51',
        sugestaoId: '72',
        texto: 'Mensagem mascarada.',
        rascunho: 'Sugestão gerada.',
        criadoEm: new Date('2026-11-26T10:00:00Z'),
        alunoNome: 'Aluno de teste',
      },
    ];
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: '3' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: pendentes, rowCount: 1 });
    const postgres = {
      transaction: <T>(operation: (client: PoolClient) => Promise<T>) =>
        operation({ query } as unknown as PoolClient),
    } as unknown as PostgresService;
    const service = new RevisaoSugestaoService(postgres);

    await expect(service.listarPendentes(professor)).resolves.toEqual(
      pendentes,
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "WHERE mensagem.professor_id = $1 AND mensagem.status = 'aberto'",
      ),
      ['3'],
    );
  });

  it('lista os chamados do aluno autenticado e inclui a resposta final', async () => {
    const chamados = [
      {
        mensagemId: '51',
        professorNome: 'Professor',
        texto: 'Mensagem do aluno.',
        status: 'RESPONDIDO',
        criadoEm: new Date('2026-11-26T10:00:00Z'),
        resposta: 'Resposta revisada.',
        decisao: RevisaoDecisao.EDITADA,
        respondidoEm: new Date('2026-11-26T11:00:00Z'),
      },
    ];
    const { service, query } = criarService([[{ id: '11' }], chamados]);

    await expect(service.listarChamadosDoAluno(aluno)).resolves.toEqual(
      chamados,
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO usuarios'),
      ['aluno', 'Aluno de teste', 'student@example.com', 'student-uid'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'WHERE mensagem.usuario_id = $1 AND mensagem.professor_id <> $1',
      ),
      ['11'],
    );
    expect(query.mock.calls[1]?.[0]).toContain(
      "WHEN mensagem.status = 'respondido' THEN revisao.texto_final",
    );
  });

  it('persiste mensagem e sugestão original associadas ao professor', async () => {
    const { service, query } = criarService([
      [{ id: '3' }],
      [{ id: '51', status: 'aberto' }],
      [{ id: '8' }],
      [{ id: '72' }],
    ]);

    await expect(
      service.registrarSugestao(
        {
          texto: 'Mensagem mascarada.',
          rascunho: 'Rascunho original.',
          informacoesAdicionais: [],
          revisaoHumanaObrigatoria: true,
          modelo: 'modelo:v2',
          status: 'RASCUNHO',
        },
        professor,
      ),
    ).resolves.toEqual({ mensagemId: '51', sugestaoId: '72' });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO usuarios'),
      ['professor', 'Professor', 'professor@example.com', 'firebase-uid'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'INSERT INTO mensagens (usuario_id, professor_id, conteudo_mascarado)',
      ),
      ['3', '3', 'Mensagem mascarada.'],
    );
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO sugestoes'),
      ['51', '8', 'Rascunho original.'],
    );
  });

  it('associa o remetente aluno e o professor responsável separadamente', async () => {
    const { service, query } = criarService([
      [{ id: '10' }],
      [{ id: '11' }],
      [{ id: '51' }],
      [{ id: '8' }],
      [{ id: '72' }],
    ]);

    await expect(
      service.registrarSugestao(
        {
          texto: 'Minha dúvida sobre a avaliação.',
          rascunho: 'Rascunho para revisão.',
          informacoesAdicionais: [],
          revisaoHumanaObrigatoria: true,
          modelo: 'modelo:v2',
          status: 'RASCUNHO',
        },
        professor,
        undefined,
        aluno,
      ),
    ).resolves.toEqual({ mensagemId: '51', sugestaoId: '72' });

    expect(query).toHaveBeenNthCalledWith(1, expect.any(String), [
      'professor',
      'Professor',
      'professor@example.com',
      'firebase-uid',
    ]);
    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      'aluno',
      'Aluno de teste',
      'student@example.com',
      'student-uid',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        'INSERT INTO mensagens (usuario_id, professor_id, conteudo_mascarado)',
      ),
      ['11', '10', 'Minha dúvida sobre a avaliação.'],
    );
  });

  it('armazena a aceitação com o texto original e conclui a mensagem', async () => {
    const { service, query } = criarService([
      [{ id: '3' }],
      [{ id: '51', status: 'aberto' }],
      [{ sugestao_original: 'Rascunho original.' }],
      [{ id: '88' }],
      [],
    ]);
    const dto: RevisarSugestaoDto = {
      mensagemId: '51',
      sugestaoId: '72',
      decisao: RevisaoDecisao.ACEITA,
    };

    await expect(service.revisar(dto, professor)).resolves.toMatchObject({
      revisaoId: '88',
      decisao: RevisaoDecisao.ACEITA,
      textoFinal: 'Rascunho original.',
    });

    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO revisoes'),
      ['51', '72', '3', RevisaoDecisao.ACEITA, 'Rascunho original.', null],
    );
    expect(query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("status = 'respondido'"),
      ['51'],
    );
  });

  it('não permite revisar mensagem de outro professor', async () => {
    const { service, query } = criarService([[{ id: '3' }], []]);

    await expect(
      service.revisar(
        {
          mensagemId: '51',
          sugestaoId: '72',
          decisao: RevisaoDecisao.ACEITA,
        },
        professor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE id = $1 AND professor_id = $2'),
      ['51', '3'],
    );
  });

  it('não gera outra sugestão para um atendimento respondido', async () => {
    const { service, query } = criarService([
      [{ id: '3' }],
      [{ id: '51', status: 'respondido' }],
    ]);

    await expect(
      service.registrarSugestao(
        {
          texto: 'Mensagem mascarada.',
          rascunho: 'Outro rascunho.',
          informacoesAdicionais: [],
          revisaoHumanaObrigatoria: true,
          modelo: 'modelo:v2',
          status: 'RASCUNHO',
        },
        professor,
        '51',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('mantém a mensagem aberta quando a sugestão é rejeitada', async () => {
    const { service, query } = criarService([
      [{ id: '3' }],
      [{ id: '51', status: 'aberto' }],
      [{ sugestao_original: 'Rascunho original.' }],
      [{ id: '88' }],
    ]);

    await service.revisar(
      {
        mensagemId: '51',
        sugestaoId: '72',
        decisao: RevisaoDecisao.REJEITADA,
        justificativa: 'Precisa de mais contexto.',
      },
      professor,
    );

    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO revisoes'),
      [
        '51',
        '72',
        '3',
        RevisaoDecisao.REJEITADA,
        null,
        'Precisa de mais contexto.',
      ],
    );
  });

  it('não permite uma segunda decisão final sobre a mensagem', async () => {
    const { service, query } = criarService([
      [{ id: '3' }],
      [{ id: '51', status: 'respondido' }],
    ]);

    await expect(
      service.revisar(
        {
          mensagemId: '51',
          sugestaoId: '72',
          decisao: RevisaoDecisao.ACEITA,
        },
        professor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
