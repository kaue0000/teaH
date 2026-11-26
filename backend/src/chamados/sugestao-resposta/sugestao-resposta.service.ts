import {
  BadRequestException,
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
} from '../../ia/providers/modelo.provider';
import {
  buildSugestaoRespostaPrompt,
  protegerDadosSensiveis,
  sanitizarMarcadoresChamado,
} from './sugestao-resposta.prompt';
import pdfParse from 'pdf-parse';

const TIPOS_IMAGEM = new Set(['image/png', 'image/jpeg', 'image/webp']);
const LIMITE_CARACTERES_DOCUMENTO = 20000;

export interface SugestaoRespostaResultado {
  texto: string;
  rascunho: string;
  informacoesAdicionais: string[];
  revisaoHumanaObrigatoria: true;
  modelo: string;
  status: 'RASCUNHO';
}

const MENCIONA_CREDENCIAL =
  /\b(?:senha|password|token|código\s+de\s+autenticação|codigo\s+de\s+autenticacao|código\s+de\s+verificação|codigo\s+de\s+verificacao|secret)\b/i;
const AVISO_CREDENCIAL =
  /\b(?:não|nao|nunca|jamais)\s+(?:compartilhe|compartilhar|informe|informar|envie|enviar|forneça|forneca|fornecer|passe|passar|solicite|solicitar|peça|peca|pedir)\b.{0,50}\b(?:senha|password|token|código\s+de\s+autenticação|codigo\s+de\s+autenticacao|código\s+de\s+verificação|codigo\s+de\s+verificacao|secret)\b/i;

const CONTEUDO_PROIBIDO = [
  /\b(?:senha|password|token|secret)\s*[:=]\s*(?!\[DADO SENSÍVEL OMITIDO\])[^\s,;.]+/i,
  /\b(?:prometemos|garantimos)\b.{0,35}\b(?:resolver|resolvido|prazo|solução|solucao)\b/i,
  /\b(?:será|sera|vai ser)\s+(?:resolvido|solucionado|concluído|concluido|finalizado)\s+(?:em|até|ate|dentro de)\s+\d+\s+(?:dia|dias|hora|horas)\b/i,
  /\b(?:resolução|resolucao)\s+garantida\b/i,
  /https?:\/\//i,
];

function mencionaCredencialInsegura(texto: string): boolean {
  return texto
    .split(/(?<=[.!?;])\s+/)
    .some(
      (frase) =>
        MENCIONA_CREDENCIAL.test(frase) && !AVISO_CREDENCIAL.test(frase),
    );
}

const DECISAO_NAO_AUTORIZADA = [
  /\b(?:seu\s+)?(?:reembolso|acesso|benefício|beneficio)\s+(?:foi|está|esta|será|sera)\s+(?:aprovado|aprovada|autorizado|autorizada|concedido|concedida|liberado|liberada)\b/i,
  /\b(?:aprovamos|autorizamos|concedemos|liberamos|vamos\s+aprovar|iremos\s+aprovar|vamos\s+autorizar|iremos\s+autorizar|vamos\s+liberar|iremos\s+liberar)\b.{0,40}\b(?:reembolso|acesso|benefício|beneficio)\b/i,
  /\b(?:nota|aprova[cç][aã]o)\b.{0,50}\b(?:aprovada|aprovado|confirmada|confirmado|garantida)\b/i,
  /\b(?:aprovada|aprovado|confirmada|confirmado)\b.{0,50}\b(?:nota|aprova[cç][aã]o)\b/i,
  /\b(?:confirmo|confirmamos|confirmei)\b.{0,50}\b(?:nota|aprova[cç][aã]o)\b/i,
];

const FRASE_PROIBIDA_NO_RASCUNHO =
  'O modelo comentou instruções ou o funcionamento do sistema';
const TEMPO_INVENTADO = 'O modelo retornou tempo inventado';
const PADROES_TEMPO =
  /\b(?:desde\s+ontem|ontem|hoje|anteontem|semana\s+passada|mês\s+passado|ano\s+passado|há\s+\d+\s+dias?|nos\s+últimos\s+\d+\s+dias?|nos\s+últimos\s+\d+\s+meses?)\b/i;
const FRASES_PROIBIDAS_NO_RASCUNHO =
  /\b(?:instruções|instrução|regras?|rascunhos?|inteligência\s+artificial|em\s+andamento|em\s+análise)\b|a\s+mensagem\s+não\s+é/i;
const PALAVRAS_FUNCIONAIS = new Set([
  'a',
  'as',
  'ao',
  'aos',
  'aquilo',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'ela',
  'ele',
  'em',
  'este',
  'esta',
  'eu',
  'isso',
  'meu',
  'meus',
  'minha',
  'minhas',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'por',
  'que',
  'se',
  'sobre',
  'sua',
  'suas',
  'seu',
  'seus',
  'um',
  'uma',
  'umas',
  'uns',
  'você',
  'vocês',
]);
const RESPOSTA_PEDIR_DESCRICAO = {
  rascunho:
    'Olá. Para eu poder ajudar, poderia descrever a dúvida ou a solicitação que você deseja encaminhar?',
  informacoesAdicionais: ['Descrição da dúvida ou da solicitação'],
  revisaoHumanaObrigatoria: true as const,
};

function textoCurtoDemais(texto: string): boolean {
  const palavras =
    texto.toLocaleLowerCase('pt-BR').match(/[a-záàâãéêíóôõúüç]+/gi) ?? [];
  const palavrasDeConteudo = palavras.filter(
    (palavra) => !PALAVRAS_FUNCIONAIS.has(palavra),
  );
  return palavrasDeConteudo.length < 3;
}

function mascararDadosSensiveis(texto: string): string {
  if (
    !/\b(?:senha|password|token|secret|código\s+de\s+verificação|codigo\s+de\s+verificacao|código\s+de\s+autenticação|codigo\s+de\s+autenticacao)\b/i.test(
      texto,
    )
  ) {
    return texto;
  }

  const mascarado = texto.replace(
    /\b(?:senha|password|token|secret|código\s+de\s+verificação|codigo\s+de\s+verificacao|código\s+de\s+autenticação|codigo\s+de\s+autenticacao)\b[\s\S]{0,80}(?=[.!?]|$)/gi,
    '[DADO SENSÍVEL OMITIDO]',
  );

  if (/[.!?]$/.test(texto) && !/[.!?]$/.test(mascarado)) {
    return `${mascarado}${texto.at(-1)}`;
  }

  return mascarado;
}

function parseSugestaoResposta(
  resposta: string,
  textoOriginal: string,
  verificarTempo: boolean = true,
): Pick<
  SugestaoRespostaResultado,
  'rascunho' | 'informacoesAdicionais' | 'revisaoHumanaObrigatoria'
> {
  let valor: unknown;

  try {
    valor = JSON.parse(resposta);
  } catch {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  const objeto = valor as Record<string, unknown>;
  const rascunho = objeto.rascunho;
  const informacoesAdicionais = objeto.informacoesAdicionais;
  const camposEsperados = [
    'rascunho',
    'informacoesAdicionais',
    'revisaoHumanaObrigatoria',
  ];
  const revisaoHumanaInformada = Object.hasOwn(
    objeto,
    'revisaoHumanaObrigatoria',
  );

  if (
    Object.keys(objeto).some((campo) => !camposEsperados.includes(campo)) ||
    typeof rascunho !== 'string' ||
    !rascunho.trim() ||
    !Array.isArray(informacoesAdicionais) ||
    (revisaoHumanaInformada && objeto.revisaoHumanaObrigatoria !== true)
  ) {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  const rascunhoNormalizado = rascunho.trim();

  if (
    informacoesAdicionais.length > 3 ||
    !informacoesAdicionais.every(
      (item): item is string =>
        typeof item === 'string' && Boolean(item.trim()),
    )
  ) {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  if (FRASES_PROIBIDAS_NO_RASCUNHO.test(rascunhoNormalizado)) {
    throw new BadGatewayException(FRASE_PROIBIDA_NO_RASCUNHO);
  }

  const textos = [rascunhoNormalizado, ...informacoesAdicionais];
  if (
    informacoesAdicionais.some((item) => MENCIONA_CREDENCIAL.test(item)) ||
    textos.some(
      (texto) =>
        mencionaCredencialInsegura(texto) ||
        CONTEUDO_PROIBIDO.some((regra) => regra.test(texto)) ||
        DECISAO_NAO_AUTORIZADA.some((regra) => regra.test(texto)),
    )
  ) {
    throw new BadGatewayException(
      'O modelo retornou conteúdo proibido na sugestão de resposta',
    );
  }

  if (
    verificarTempo &&
    PADROES_TEMPO.test(rascunhoNormalizado) &&
    !PADROES_TEMPO.test(textoOriginal)
  ) {
    throw new BadGatewayException(TEMPO_INVENTADO);
  }

  return {
    rascunho: rascunhoNormalizado,
    informacoesAdicionais: informacoesAdicionais.map((item) => item.trim()),
    revisaoHumanaObrigatoria: true,
  };
}

@Injectable()
export class SugestaoRespostaService {
  constructor(
    @Inject(MODELO_PROVIDER) private readonly modelo: ModeloProvider,
  ) {}

  async sugerirResposta(
    textoOriginal?: string,
    arquivo?: Express.Multer.File,
  ): Promise<SugestaoRespostaResultado> {
    const texto = sanitizarMarcadoresChamado(textoOriginal?.trim() ?? '');

    if (!texto && !arquivo) {
      throw new BadRequestException(
        'Informe o texto do chamado ou envie um arquivo',
      );
    }

    if (!arquivo && textoCurtoDemais(texto)) {
      return this.criarRespostaFixa(texto, 'validação-local');
    }

    const mensagem = buildSugestaoRespostaPrompt(
      texto ||
        'O solicitante enviou apenas o arquivo anexado como descrição do chamado. Use o conteúdo do arquivo como contexto.',
    );
    let textoDocumento = '';

    if (arquivo) {
      if (TIPOS_IMAGEM.has(arquivo.mimetype)) {
        return this.sugerirComArquivo(
          mensagem,
          texto,
          texto,
          arquivo.buffer.toString('base64'),
        );
      }

      if (arquivo.mimetype === 'text/plain') {
        textoDocumento = arquivo.buffer.toString('utf8').trim();
      } else if (arquivo.mimetype === 'application/pdf') {
        try {
          textoDocumento = (await pdfParse(arquivo.buffer)).text.trim();
        } catch {
          throw new BadRequestException('Não foi possível ler o arquivo PDF');
        }
      } else {
        throw new UnsupportedMediaTypeException(
          'Envie PNG, JPEG, WebP, PDF ou TXT',
        );
      }

      if (!textoDocumento) {
        throw new BadRequestException('O documento enviado está vazio');
      }

      if (textoDocumento.length > LIMITE_CARACTERES_DOCUMENTO) {
        throw new BadRequestException(
          'O documento ultrapassa o limite de caracteres',
        );
      }

      textoDocumento = protegerDadosSensiveis(
        sanitizarMarcadoresChamado(textoDocumento),
      );

      return this.sugerirComArquivo(
        mensagem,
        texto,
        `${texto}\n${textoDocumento}`,
        undefined,
        textoDocumento,
      );
    }

    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      this.registrarPrompt(mensagem);
      const resultado = await this.modelo.gerar({ mensagem, format: 'json' });

      try {
        const sugestao = parseSugestaoResposta(resultado.resposta, texto);

        return {
          texto: mascararDadosSensiveis(texto),
          ...sugestao,
          modelo: resultado.modelo,
          status: 'RASCUNHO',
        };
      } catch (error) {
        if (error instanceof BadGatewayException) {
          if (
            tentativa === 0 &&
            error.message === FRASE_PROIBIDA_NO_RASCUNHO
          ) {
            continue;
          }

          if (tentativa === 1 && error.message === FRASE_PROIBIDA_NO_RASCUNHO) {
            return this.criarRespostaFixa(texto, resultado.modelo);
          }
        }

        throw error;
      }
    }

    throw new BadGatewayException(
      'Não foi possível gerar uma sugestão de resposta válida',
    );
  }

  private async sugerirComArquivo(
    mensagem: string,
    textoOriginal: string,
    textoParaValidacao: string,
    imagemBase64?: string,
    documento?: string,
  ): Promise<SugestaoRespostaResultado> {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      this.registrarPrompt(mensagem, documento);
      const resultado = await this.modelo.analisarArquivo({
        prompt: mensagem,
        ...(imagemBase64 ? { imagemBase64 } : {}),
        ...(documento ? { textoDocumento: documento } : {}),
        format: 'json',
      });

      try {
        const sugestao = parseSugestaoResposta(
          resultado.resposta,
          textoParaValidacao,
          !imagemBase64,
        );

        return {
          texto: mascararDadosSensiveis(textoOriginal),
          ...sugestao,
          modelo: resultado.modelo,
          status: 'RASCUNHO',
        };
      } catch (error) {
        if (error instanceof BadGatewayException) {
          if (
            tentativa === 0 &&
            error.message === FRASE_PROIBIDA_NO_RASCUNHO
          ) {
            continue;
          }

          if (tentativa === 1 && error.message === FRASE_PROIBIDA_NO_RASCUNHO) {
            return this.criarRespostaFixa(textoOriginal, resultado.modelo);
          }
        }

        throw error;
      }
    }

    throw new BadGatewayException(
      'Não foi possível gerar uma sugestão de resposta válida',
    );
  }

  private registrarPrompt(mensagem: string, documento?: string): void {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test'
    ) {
      Logger.debug(
        JSON.stringify({
          prompt: mensagem,
          ...(documento ? { textoDocumento: documento } : {}),
        }),
        SugestaoRespostaService.name,
      );
    }
  }

  private criarRespostaFixa(
    texto: string,
    modelo: string,
  ): SugestaoRespostaResultado {
    return {
      texto: mascararDadosSensiveis(sanitizarMarcadoresChamado(texto)),
      ...RESPOSTA_PEDIR_DESCRICAO,
      modelo,
      status: 'RASCUNHO',
    };
  }
}
