import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CalculateSalesOrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityBags = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bagWeightKg = 25;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerBag = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerBag?: number;
}

export class CalculateSalesOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalculateSalesOrderItemDto)
  items!: CalculateSalesOrderItemDto[];

  @IsOptional()
  @IsIn(['particular', 'compra_venda', 'intermediacao', 'venda_estoque'])
  saleType: 'particular' | 'compra_venda' | 'intermediacao' | 'venda_estoque' = 'particular';

  @IsOptional()
  @IsIn(['fixed', 'percentage'])
  brokerageFeeType?: 'fixed' | 'percentage';

  @IsOptional()
  @IsNumber()
  @Min(0)
  brokerageFeeValue?: number;

  @IsOptional()
  @IsIn(['producer', 'customer', 'both'])
  brokeragePayer?: 'producer' | 'customer' | 'both';

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralRate = 0.0163;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralSocialSecurityRate = 0.0132;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralRatRate = 0.0011;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralSenarRate = 0.0020;
  
  @IsOptional()
  @IsNumber()
  @Min(0)
  nfeTotalAmount?: number;

  @IsOptional()
  @IsString()
  producerId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
