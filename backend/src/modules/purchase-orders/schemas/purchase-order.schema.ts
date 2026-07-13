import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type PurchaseOrderDocument = HydratedDocument<PurchaseOrder>;

export const PURCHASE_ORDER_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;
export const PAYMENT_TYPES = ['cash', 'term'] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const FISCAL_STATUSES = ['pending', 'issued', 'divergent', 'cancelled'] as const;
export type FiscalStatus = (typeof FISCAL_STATUSES)[number];

@Schema({ _id: false })
export class PurchaseOrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  quantityBags!: number;

  @Prop({ type: Number, required: true, min: 0, default: 25 })
  bagWeightKg!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  quantityKg!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  costPerBag!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  lineTotal!: number;
}

export const PurchaseOrderItemSchema = SchemaFactory.createForClass(PurchaseOrderItem);

@Schema({ timestamps: true })
export class PurchaseOrder extends AuditableSchema {
  @Prop({ type: String, required: true, unique: true, index: true })
  orderNumber!: string;

  @Prop({
    type: String,
    enum: PURCHASE_ORDER_STATUSES,
    default: 'draft',
    index: true,
  })
  status!: PurchaseOrderStatus;

  @Prop({
    type: String,
    enum: FISCAL_STATUSES,
    default: 'pending',
    index: true,
  })
  fiscalStatus!: FiscalStatus;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  date!: Date;



  @Prop({ type: Types.ObjectId, ref: 'Producer', index: true })
  producerId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  originLocation?: string;

  @Prop({ type: String, enum: PAYMENT_TYPES, default: 'cash', index: true })
  paymentType!: PaymentType;

  @Prop({ type: Number, min: 0 })
  termDays?: number;

  @Prop({ type: Date, index: true })
  dueDate?: Date;

  @Prop({ type: Boolean, default: false })
  dueDateManual!: boolean;

  @Prop({ type: [PurchaseOrderItemSchema], default: [] })
  items!: PurchaseOrderItem[];

  @Prop({ type: Number, default: 0, min: 0 })
  totalBags!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalKg!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalAmount!: number;

  @Prop({ type: Number, default: 0.015, min: 0 })
  funruralRate!: number;

  @Prop({ type: Number, default: 0.012, min: 0 })
  funruralSocialSecurityRate!: number;

  @Prop({ type: Number, default: 0.001, min: 0 })
  funruralRatRate!: number;

  @Prop({ type: Number, default: 0.002, min: 0 })
  funruralSenarRate!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  funruralSocialSecurityAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  funruralRatAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  funruralSenarAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  funruralRetentionAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  producerNetAmount!: number;

  @Prop({ type: String, trim: true })
  paymentMethod?: string;

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
PurchaseOrderSchema.index({ date: -1, status: 1 });
PurchaseOrderSchema.index({ orderNumber: 1, isDeleted: 1 });
