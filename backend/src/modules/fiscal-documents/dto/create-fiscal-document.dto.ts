import { IsDateString, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FISCAL_DOCUMENT_STATUSES, FiscalDocumentStatus } from '../schemas/fiscal-document.schema';

export class CreateFiscalDocumentDto {
  @IsOptional()
  @IsMongoId()
  salesOrderId?: string;

  @IsOptional()
  @IsMongoId()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  series?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsIn(FISCAL_DOCUMENT_STATUSES)
  status?: FiscalDocumentStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
