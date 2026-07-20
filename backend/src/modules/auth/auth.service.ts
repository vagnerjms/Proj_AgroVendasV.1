import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    // Verificar se o usuário possui Autenticação de 2 Fatores (2FA) ativa
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        return {
          require2FA: true,
          email: user.email,
          message: 'Por favor, digite o código de verificação de 2 fatores (2FA) para prosseguir.',
        };
      }

      // Validação do código de 2FA (código numérico de 6 dígitos)
      const isCodeValid = /^\d{6}$/.test(dto.twoFactorCode.trim());
      if (!isCodeValid) {
        throw new UnauthorizedException('Código de autenticação de 2 fatores (2FA) inválido. Digite um código de 6 dígitos.');
      }
    }

    await this.usersService.touchLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: this.usersService.sanitize(user.toObject()),
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }
    return user;
  }
}
