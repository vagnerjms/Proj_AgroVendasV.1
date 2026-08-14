import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateFiscalDocumentDto } from './create-fiscal-document.dto';

export class UpdateFiscalDocumentDto extends PartialType(CreateFiscalDocumentDto) {
  @IsOptional()
  @IsBoolean()
  adjustOrderAmount?: boolean;
}
