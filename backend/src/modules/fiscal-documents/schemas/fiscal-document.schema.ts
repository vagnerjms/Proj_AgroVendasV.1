import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type FiscalDocumentDocument = HydratedDocument<FiscalDocument>;

export const FISCAL_DOCUMENT_STATUSES = ['pending', 'issued', 'divergent', 'cancelled'] as const;
export const FISCAL_FILE_KINDS = ['danfe_pdf', 'xml', 'image', 'other'] as const;

export type FiscalDocumentStatus = (typeof FISCAL_DOCUMENT_STATUSES)[number];
export type FiscalFileKind = (typeof FISCAL_FILE_KINDS)[number];

@Schema({ _id: false })
export class FiscalDocumentItem {
  @Prop({ trim: true, required: true })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop({ type: Number, min: 0 })
  quantityKg?: number;

  @Prop({ type: Number, min: 0 })
  unitPrice?: number;

  @Prop({ type: Number, min: 0 })
  totalAmount?: number;

  @Prop({ trim: true })
  quantityKgRaw?: string;

  @Prop({ trim: true })
  unitPriceRaw?: string;

  @Prop({ trim: true })
  totalAmountRaw?: string;

  @Prop({ type: Number, min: 0 })
  quantityKgDecimalPlaces?: number;

  @Prop({ type: Number, min: 0 })
  unitPriceDecimalPlaces?: number;

  @Prop({ type: Number, min: 0 })
  totalAmountDecimalPlaces?: number;
}

export const FiscalDocumentItemSchema = SchemaFactory.createForClass(FiscalDocumentItem);

@Schema({ _id: true, timestamps: false })
export class FiscalDocumentFile {
  @Prop({ required: true, enum: FISCAL_FILE_KINDS })
  kind!: FiscalFileKind;

  @Prop({ required: true, trim: true })
  originalName!: string;

  @Prop({ required: true, trim: true })
  mimeType!: string;

  @Prop({ required: true, min: 0 })
  size!: number;

  @Prop({ required: true, trim: true })
  storagePath!: string;

  @Prop({ required: true, default: Date.now })
  uploadedAt!: Date;
}

export const FiscalDocumentFileSchema = SchemaFactory.createForClass(FiscalDocumentFile);

@Schema({ timestamps: true })
export class FiscalDocument extends AuditableSchema {
  @Prop({ type: Types.ObjectId, ref: 'SalesOrder', index: true })
  salesOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', index: true })
  purchaseOrderId?: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  orderNumber!: string;

  @Prop({ trim: true, unique: true, sparse: true, index: true })
  accessKey?: string;

  @Prop({ trim: true, index: true })
  number?: string;

  @Prop({ trim: true })
  series?: string;

  @Prop({ index: true })
  issuedAt?: Date;

  @Prop({ trim: true })
  issuer?: string;

  @Prop({ trim: true })
  recipient?: string;

  @Prop({ min: 0 })
  amount?: number;

  @Prop({ type: [FiscalDocumentItemSchema], default: [] })
  items!: FiscalDocumentItem[];

  @Prop({ min: 0 })
  totalWeightKg?: number;

  @Prop({ min: 0 })
  unitPrice?: number;

  @Prop({ trim: true })
  unitPriceRaw?: string;

  @Prop({ trim: true })
  amountRaw?: string;

  @Prop({ min: 0 })
  weightDecimalPlaces?: number;

  @Prop({ min: 0 })
  unitPriceDecimalPlaces?: number;

  @Prop({ min: 0 })
  amountDecimalPlaces?: number;

  @Prop({ enum: ['xml', 'ocr', 'manual', 'none'], default: 'none' })
  extractionMethod!: 'xml' | 'ocr' | 'manual' | 'none';

  @Prop({ min: 0, max: 1 })
  extractionConfidence?: number;

  @Prop({ trim: true })
  extractionError?: string;

  @Prop({
    enum: FISCAL_DOCUMENT_STATUSES,
    default: 'pending',
    index: true,
  })
  status!: FiscalDocumentStatus;

  @Prop({ type: [FiscalDocumentFileSchema], default: [] })
  files!: FiscalDocumentFile[];

  @Prop({ trim: true })
  notes?: string;
}

export const FiscalDocumentSchema = SchemaFactory.createForClass(FiscalDocument);
FiscalDocumentSchema.index({ orderNumber: 1, isDeleted: 1 });
FiscalDocumentSchema.index({ issuedAt: -1, status: 1 });
