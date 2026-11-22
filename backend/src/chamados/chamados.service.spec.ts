import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  MODELO_PROVIDER,
} from '../ia/providers/modelo.provider';
import { ChamadosService } from './chamados.service';

describe('ChamadosService', () => {
  const gerar = jest.fn();
  let service: ChamadosService;

  beforeEach(async () => {
    gerar.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChamadosService,
        {
          provide: MODELO_PROVIDER,
          useValue: { gerar },
        },
      ],
    }).compile();

    service = moduleRef.get(ChamadosService);
  });

  it('aceita uma categoria permitida', async () => {
    gerar.mockResolvedValue({
      resposta:
        'CATEGORIA: ACESSO\nJUSTIFICATIVA: problema para autenticar.',
      modelo: 'modelo-controlado',
    });

    await expect(
      service.classificar('Minha senha foi bloqueada.'),
    ).resolves.toMatchObject({
      categoria: 'ACESSO',
      status: 'CLASSIFICADO',
      justificativa: 'problema para autenticar.',
    });
  });

  it('representa abstenção sem inventar uma categoria', async () => {
    gerar.mockResolvedValue({
      resposta:
        'CATEGORIA: NAO_CLASSIFICADO\nJUSTIFICATIVA: faltam informações.',
      modelo: 'modelo-controlado',
    });

    await expect(
      service.classificar('Preciso de ajuda.'),
    ).resolves.toMatchObject({
      categoria: null,
      status: 'NAO_CLASSIFICADO',
      justificativa: 'faltam informações.',
    });
  });

  it('rejeita categoria inventada ou resposta fora do formato', async () => {
    gerar.mockResolvedValue({
      resposta:
        'CATEGORIA: SUPORTE_TECNICO\nJUSTIFICATIVA: erro no computador.',
      modelo: 'modelo-controlado',
    });

    await expect(
      service.classificar('O computador está lento.'),
    ).rejects.toThrow('formato inválido');
  });
});
