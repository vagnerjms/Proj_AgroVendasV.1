import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Length, Min, MinLength } from 'class-validator';

export class CreateCustomerDto {
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
  deliveryAddress?: string;

  @IsString()
  city!: string;

  @IsString()
  @Length(2, 2)
  state!: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit = 0;

  @IsOptional()
  @IsIn(['ok', 'watch', 'blocked'])
  financialStatus = 'ok';

  @IsOptional()
  @IsBoolean()
  active = true;
}
