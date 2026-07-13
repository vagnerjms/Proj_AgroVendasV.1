import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsOptional()
  @IsIn(['kg', 'caixa', 'saca', 'tonelada', 'unidade'])
  defaultUnit = 'kg';

  @IsOptional()
  @IsBoolean()
  active = true;

  @IsString()
  @MinLength(2)
  internalCode!: string;

  @IsOptional()
  @IsBoolean()
  marketReferenceEnabled = false;
}
