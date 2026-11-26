import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { RevisaoDecisao } from '../revisao-decisao';

const ID_POSITIVO = /^[1-9]\d*$/;

export class RevisarSugestaoDto {
  @IsString()
  @Matches(ID_POSITIVO)
  mensagemId: string;

  @IsOptional()
  @IsString()
  @Matches(ID_POSITIVO)
  sugestaoId?: string;

  @IsEnum(RevisaoDecisao)
  decisao: RevisaoDecisao;

  @ValidateIf(
    (dto: RevisarSugestaoDto) =>
      dto.decisao === RevisaoDecisao.EDITADA ||
      dto.decisao === RevisaoDecisao.MANUAL,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  textoFinal?: string;

  @ValidateIf(
    (dto: RevisarSugestaoDto) => dto.decisao === RevisaoDecisao.REJEITADA,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  justificativa?: string;
}
