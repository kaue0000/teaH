import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SugerirRespostaDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  texto?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  mensagemId?: string;
}
