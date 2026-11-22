export const CHAMADO_CATEGORIAS = [
  'ACESSO',
  'FINANCEIRO',
  'DOCUMENTOS',
  'SISTEMA',
] as const;

export type ChamadoCategoria =
  (typeof CHAMADO_CATEGORIAS)[number];

export function isChamadoCategoria(
  value: string,
): value is ChamadoCategoria {
  return CHAMADO_CATEGORIAS.includes(
    value as ChamadoCategoria,
  );
}