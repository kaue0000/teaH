import {
  IsEmail,
  IsOptional,
  Matches,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/\S/)
  serie?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}
