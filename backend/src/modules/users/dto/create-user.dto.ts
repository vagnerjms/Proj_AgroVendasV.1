import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { USER_ROLES, UserRole } from '../user-role';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(USER_ROLES)
  role!: UserRole;

  @IsOptional()
  @IsBoolean()
  active = true;

  @IsOptional()
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;
}
