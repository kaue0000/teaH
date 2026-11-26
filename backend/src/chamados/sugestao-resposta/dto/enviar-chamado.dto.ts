import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EnviarChamadoDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  professorId: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  texto?: string;
}
