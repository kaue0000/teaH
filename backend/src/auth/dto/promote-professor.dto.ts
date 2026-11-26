import { IsString, Matches } from 'class-validator';

export class PromoteProfessorDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  uid: string;
}
