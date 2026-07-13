import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtGuard } from './guards/jwt.guard';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './types/authenticated-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.sub);
  }
}
