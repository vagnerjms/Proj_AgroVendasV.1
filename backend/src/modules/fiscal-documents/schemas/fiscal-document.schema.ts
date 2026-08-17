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
  @Prop({ type: String, trim: true, required: true })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;

  @Prop({ type: Number, min: 0 })
  quantityKg?: number;

  @Prop({ type: Number, min: 0 })
  unitPrice?: number;

  @Prop({ type: Number, min: 0 })
  totalAmount?: number;

  @Prop({ type: String, trim: true })
  quantityKgRaw?: string;

  @Prop({ type: String, trim: true })
  unitPriceRaw?: string;

  @Prop({ type: String, trim: true })
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
  @Prop({ type: String, required: true, enum: FISCAL_FILE_KINDS })
  kind!: FiscalFileKind;

  @Prop({ type: String, required: true, trim: true })
  originalName!: string;

  @Prop({ type: String, required: true, trim: true })
  mimeType!: string;

  @Prop({ type: Number, required: true, min: 0 })
  size!: number;

  @Prop({ type: String, required: true, trim: true })
  storagePath!: string;

  @Prop({ type: Date, required: true, default: Date.now })
  uploadedAt!: Date;
}

export const FiscalDocumentFileSchema = SchemaFactory.createForClass(FiscalDocumentFile);

@Schema({ timestamps: true })
export class FiscalDocument extends AuditableSchema {
  @Prop({ type: Types.ObjectId, ref: 'SalesOrder', index: true })
  salesOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', index: true })
  purchaseOrderId?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, index: true })
  orderNumber!: string;

  @Prop({ type: String, trim: true, unique: true, sparse: true, index: true })
  accessKey?: string;

  @Prop({ type: String, trim: true, index: true })
  number?: string;

  @Prop({ type: String, trim: true })
  series?: string;

  @Prop({ type: Date, index: true })
  issuedAt?: Date;

  @Prop({ type: String, trim: true })
  issuer?: string;

  @Prop({ type: String, trim: true })
  recipient?: string;

  @Prop({ type: Number, min: 0 })
  amount?: number;

  @Prop({ type: [FiscalDocumentItemSchema], default: [] })
  items!: FiscalDocumentItem[];

  @Prop({ type: Number, min: 0 })
  totalWeightKg?: number;

  @Prop({ type: String, trim: true })
  totalWeightRaw?: string;

  @Prop({ type: Number, min: 0 })
  unitPrice?: number;

  @Prop({ type: String, trim: true })
  unitPriceRaw?: string;

  @Prop({ type: String, trim: true })
  amountRaw?: string;

  @Prop({ type: Number, min: 0 })
  weightDecimalPlaces?: number;

  @Prop({ type: Number, min: 0 })
  unitPriceDecimalPlaces?: number;

  @Prop({ type: Number, min: 0 })
  amountDecimalPlaces?: number;

  @Prop({ type: String, enum: ['xml', 'ocr', 'manual', 'none'], default: 'none' })
  extractionMethod!: 'xml' | 'ocr' | 'manual' | 'none';

  @Prop({ type: Number, min: 0, max: 1 })
  extractionConfidence?: number;

  @Prop({ type: String, trim: true })
  extractionError?: string;

  @Prop({
    type: String,
    enum: FISCAL_DOCUMENT_STATUSES,
    default: 'pending',
    index: true,
  })
  status!: FiscalDocumentStatus;

  @Prop({ type: [FiscalDocumentFileSchema], default: [] })
  files!: FiscalDocumentFile[];

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: Boolean, default: false })
  adjustOrderAmount?: boolean;
}

export const FiscalDocumentSchema = SchemaFactory.createForClass(FiscalDocument);
FiscalDocumentSchema.index({ orderNumber: 1, isDeleted: 1 });
FiscalDocumentSchema.index({ issuedAt: -1, status: 1 });
