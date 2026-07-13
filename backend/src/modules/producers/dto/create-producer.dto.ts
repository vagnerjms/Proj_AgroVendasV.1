import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Length, Min, MinLength } from 'class-validator';

export class CreateProducerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(['cpf', 'cnpj'])
  documentType!: string;

  @IsString()
  @MinLength(5)
  documentNumber!: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  ruralRegistration?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  city!: string;

  @IsString()
  @Length(2, 2)
  state!: string;

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsObject()
  bankInfo?: Record<string, unknown>;

  @IsOptional()
  funruralConfig?: { enabled: boolean; rate: number };

  @IsOptional()
  @IsObject()
  accountantContact?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active = true;
}
