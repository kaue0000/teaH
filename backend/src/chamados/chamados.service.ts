import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
} from '../ia/providers/modelo.provider';
import { isChamadoCategoria, type ChamadoCategoria } from './chamado-categoria';
import { buildClassificacaoPrompt } from './classificacao.prompt';

export interface ClassificacaoResultado {
  texto: string;
  categoria: ChamadoCategoria | null;
  status: 'CLASSIFICADO' | 'NAO_CLASSIFICADO';
  justificativa: string;
  modelo: string;
}

const RESPOSTA_CLASSIFICACAO =
  /^CATEGORIA:\s*(ACESSO|FINANCEIRO|DOCUMENTOS|SISTEMA|NAO_CLASSIFICADO)\s*\r?\nJUSTIFICATIVA:\s*(.+)$/i;

@Injectable()
export class ChamadosService {
  constructor(
    @Inject(MODELO_PROVIDER)
    private readonly modelo: ModeloProvider,
  ) {}

  async classificar(textoOriginal: string): Promise<ClassificacaoResultado> {
    const texto = textoOriginal.trim();
    const prompt = buildClassificacaoPrompt(texto);
    const resultado = await this.modelo.gerar({ mensagem: prompt });
    const correspondencia = RESPOSTA_CLASSIFICACAO.exec(
      resultado.resposta.trim(),
    );

    if (!correspondencia) {
      throw new BadGatewayException(
        'O modelo retornou uma classificação em formato inválido',
      );
    }

    const categoriaRecebida = correspondencia[1].toUpperCase();
    const justificativa = correspondencia[2].trim();
    const naoClassificado = categoriaRecebida === 'NAO_CLASSIFICADO';

    if (!justificativa) {
      throw new BadGatewayException(
        'O modelo retornou uma classificação inválida',
      );
    }

    let categoria: ChamadoCategoria | null = null;
    if (!naoClassificado) {
      if (!isChamadoCategoria(categoriaRecebida)) {
        throw new BadGatewayException(
          'O modelo retornou uma classificação inválida',
        );
      }
      categoria = categoriaRecebida;
    }

    return {
      texto,
      categoria,
      status: naoClassificado ? 'NAO_CLASSIFICADO' : 'CLASSIFICADO',
      justificativa,
      modelo: resultado.modelo,
    };
  }
}
