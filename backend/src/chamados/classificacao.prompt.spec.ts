import { buildClassificacaoPrompt } from './classificacao.prompt';

describe('buildClassificacaoPrompt', () => {
  it('inclui o chamado entre delimitadores', () => {
    const prompt = buildClassificacaoPrompt('Minha senha expirou.');

    expect(prompt).toContain('<chamado>\nMinha senha expirou.\n</chamado>');
  });

  it('declara todas as categorias', () => {
    const prompt = buildClassificacaoPrompt('Preciso de ajuda.');

    for (const categoria of [
      'ACESSO',
      'FINANCEIRO',
      'DOCUMENTOS',
      'SISTEMA',
    ]) {
      expect(prompt).toContain(categoria);
    }
  });

  it('orienta o modelo a se abster quando faltam dados ou o assunto é externo', () => {
    const prompt = buildClassificacaoPrompt('Preciso de ajuda.');

    expect(prompt).toContain('Não utilize conhecimento externo');
    expect(prompt).toContain('NAO_CLASSIFICADO');
    expect(prompt).toContain('JUSTIFICATIVA');
  });
});