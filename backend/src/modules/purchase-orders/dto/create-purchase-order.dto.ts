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
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PAYMENT_TYPES,
  PaymentType,
  PURCHASE_ORDER_STATUSES,
  PurchaseOrderStatus,
} from '../schemas/purchase-order.schema';

export class PurchaseOrderItemDto {
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
  costPerBag!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityKg?: number;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsMongoId()
  draftId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsMongoId()
  producerId!: string;

  @IsOptional()
  @IsString()
  originLocation?: string;

  @IsOptional()
  @IsIn(PURCHASE_ORDER_STATUSES)
  status: PurchaseOrderStatus = 'confirmed';

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralRate = 0.015;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralSocialSecurityRate = 0.012;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralRatRate = 0.001;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralSenarRate = 0.002;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
