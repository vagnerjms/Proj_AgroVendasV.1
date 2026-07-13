import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type FiscalDocumentDocument = HydratedDocument<FiscalDocument>;

export const FISCAL_DOCUMENT_STATUSES = ['pending', 'issued', 'divergent', 'cancelled'] as const;
export const FISCAL_FILE_KINDS = ['danfe_pdf', 'xml', 'image', 'other'] as const;

export type FiscalDocumentStatus = (typeof FISCAL_DOCUMENT_STATUSES)[number];
export type FiscalFileKind = (typeof FISCAL_FILE_KINDS)[number];

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
