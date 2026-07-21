import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PAYMENT_TYPES,
  PaymentType,
  SALES_ORDER_STATUSES,
  SalesOrderStatus,
} from '../schemas/sales-order.schema';

export class SalesOrderItemDto {
  @IsMongoId()
  productId!: string;

  @IsNumber()
  @Min(0)
  quantityBags!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bagWeightKg = 25;

  @IsNumber()
  @Min(0)
  pricePerBag!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerBag?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityKg?: number;
}

export class CreateSalesOrderDto {
  @IsOptional()
  @IsMongoId()
  draftId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsMongoId()
  producerId?: string;

  @IsMongoId()
  customerId!: string;

  @IsOptional()
  @IsString()
  originLocation?: string;

  @IsString()
  destinationCity!: string;

  @IsString()
  @Length(2, 2)
  destinationState!: string;

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
  @IsIn(SALES_ORDER_STATUSES)
  status: SalesOrderStatus = 'confirmed';

  @IsIn(PAYMENT_TYPES)
  paymentType!: PaymentType;

  @IsOptional()
  @IsInt()
  @Min(0)
  termDays?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  dueDateManual = false;

  @IsOptional()
  @IsIn(PAYMENT_TYPES)
  producerPaymentType?: PaymentType;

  @IsOptional()
  @IsInt()
  @Min(0)
  producerTermDays?: number;

  @IsOptional()
  @IsDateString()
  producerDueDate?: string;

  @IsOptional()
  @IsBoolean()
  producerDueDateManual?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items!: SalesOrderItemDto[];

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
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsIn(['pending', 'requested', 'issued', 'divergent', 'cancelled'])
  fiscalStatus = 'pending';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  attachments: string[] = [];
}
