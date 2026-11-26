import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PromoteProfessorDto } from './dto/promote-professor.dto';
import { RegisterDto } from './dto/register.dto';
import { FirebaseAdminGuard } from './firebase-admin.guard';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('admin/promover-professor')
  @UseGuards(FirebaseAdminGuard)
  promoverProfessor(@Body() dto: PromoteProfessorDto) {
    return this.authService.promoverProfessor(dto.uid);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Headers('authorization') authorization?: string) {
    const parts = authorization?.split(' ') ?? [];
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new UnauthorizedException('Token Bearer obrigatório.');
    }

    return this.authService.logout(parts[1]);
  }
}
