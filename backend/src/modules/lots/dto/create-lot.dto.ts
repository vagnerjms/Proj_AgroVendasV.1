import { IsString, IsNumber, IsOptional, IsEnum, Min, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { LOT_STATUSES, LotStatus } from '../schemas/lot.schema';

export class CreateLotDto {
  @IsMongoId()
  producerId!: string;

  @IsMongoId()
  productId!: string;

  @IsNumber()
  @Min(0)
  quantityBags!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bagWeightKg?: number;

  @IsString()
  cropYear!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(LOT_STATUSES)
  status?: LotStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
