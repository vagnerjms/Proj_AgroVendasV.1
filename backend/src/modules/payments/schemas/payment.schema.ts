import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type PaymentDocument = HydratedDocument<Payment>;

export const PAYMENT_TYPES = ['receivable', 'payable'] as const;
export const PAYMENT_STATUSES = ['open', 'partial', 'paid', 'overdue', 'cancelled'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

@Schema({ _id: true, timestamps: false })
export class PaymentHistoryEntry {
  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: Date, required: true })
  paidAt!: Date;

  @Prop({ type: String, trim: true })
  method?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;
}

export const PaymentHistoryEntrySchema = SchemaFactory.createForClass(PaymentHistoryEntry);

@Schema({ timestamps: true })
export class Payment extends AuditableSchema {
  @Prop({ type: String, enum: PAYMENT_TYPES, default: 'receivable', index: true })
  type!: PaymentType;

  @Prop({ type: Types.ObjectId, ref: 'SalesOrder', index: true })
  salesOrderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', index: true })
  purchaseOrderId?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, index: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true })
  customerId?: Types.ObjectId;

  @Prop({ type: String, trim: true, index: true })
  customerName?: string;

  @Prop({ type: String, trim: true })
  customerWhatsapp?: string;

  @Prop({ type: Types.ObjectId, ref: 'Producer', index: true })
  producerId?: Types.ObjectId;

  @Prop({ type: String, trim: true, index: true })
  producerName?: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  paidAmount!: number;

  @Prop({ type: Number, required: true, min: 0 })
  balanceAmount!: number;

  @Prop({ type: Date, required: true, index: true })
  dueDate!: Date;

  @Prop({ type: Date, index: true })
  paidAt?: Date;

  @Prop({ type: String, trim: true })
  method?: string;

  @Prop({ type: String, enum: PAYMENT_STATUSES, default: 'open', index: true })
  status!: PaymentStatus;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: [PaymentHistoryEntrySchema], default: [] })
  history!: PaymentHistoryEntry[];
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ salesOrderId: 1, type: 1, isDeleted: 1 }, { unique: true, partialFilterExpression: { salesOrderId: { $exists: true } } });
PaymentSchema.index({ purchaseOrderId: 1, type: 1, isDeleted: 1 }, { unique: true, partialFilterExpression: { purchaseOrderId: { $exists: true } } });
PaymentSchema.index({ dueDate: 1, status: 1 });
