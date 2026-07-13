import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SettlePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
