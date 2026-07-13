import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type SalesOrderDocument = HydratedDocument<SalesOrder>;

export const SALES_ORDER_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;
export const PAYMENT_TYPES = ['cash', 'term'] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];
export type PaymentType = (typeof PAYMENT_TYPES)[number];

@Schema({ _id: false })
export class SalesOrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  quantityBags!: number;

  @Prop({ type: Number, required: true, min: 0, default: 25 })
  bagWeightKg!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  quantityKg!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  pricePerBag!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  lineTotal!: number;

  @Prop({ type: Number, required: false, min: 0, default: 0 })
  costPerBag?: number;

  @Prop({ type: Number, required: false, min: 0, default: 0 })
  lineCostTotal?: number;
}

export const SalesOrderItemSchema = SchemaFactory.createForClass(SalesOrderItem);

@Schema({ timestamps: true })
export class SalesOrder extends AuditableSchema {
  @Prop({ type: String, required: true, unique: true, index: true })
  orderNumber!: string;

  @Prop({ type: String, enum: ['particular', 'compra_venda', 'intermediacao', 'venda_estoque'], default: 'particular', index: true })
  saleType!: 'particular' | 'compra_venda' | 'intermediacao' | 'venda_estoque';

  @Prop({ type: String, enum: ['fixed', 'percentage'] })
  brokerageFeeType?: 'fixed' | 'percentage';

  @Prop({ type: Number, min: 0 })
  brokerageFeeValue?: number;

  @Prop({ type: Number, min: 0 })
  brokerageAmount?: number;

  @Prop({ type: String, enum: ['producer', 'customer', 'both'] })
  brokeragePayer?: 'producer' | 'customer' | 'both';

  @Prop({ type: Number, min: 0 })
  marginAmount?: number;

  @Prop({
    type: String,
    enum: SALES_ORDER_STATUSES,
    default: 'draft',
    index: true,
  })
  status!: SalesOrderStatus;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  date!: Date;



  @Prop({ type: Types.ObjectId, ref: 'Producer', index: true })
  producerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', index: true })
  customerId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  originLocation?: string;

  @Prop({ type: String, trim: true, index: true })
  destinationCity?: string;

  @Prop({ type: String, trim: true, uppercase: true, minlength: 2, maxlength: 2, index: true })
  destinationState?: string;

  @Prop({ type: String, enum: PAYMENT_TYPES, default: 'cash', index: true })
  paymentType!: PaymentType;

  @Prop({ type: Number, min: 0 })
  termDays?: number;

  @Prop({ type: Date, index: true })
  dueDate?: Date;

  @Prop({ type: Boolean, default: false })
  dueDateManual!: boolean;

  @Prop({ type: [SalesOrderItemSchema], default: [] })
  items!: SalesOrderItem[];

  @Prop({ type: Number, default: 0, min: 0 })
  totalBags!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalKg!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalParticularAmount!: number;

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
  totalReceivableAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  producerNetAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalCostAmount?: number;

  @Prop({ type: Date, index: true })
  producerDueDate?: Date;

  @Prop({ type: String, enum: PAYMENT_TYPES, index: true })
  producerPaymentType?: PaymentType;

  @Prop({ type: Number, min: 0 })
  producerTermDays?: number;

  @Prop({ type: Boolean, default: false })
  producerDueDateManual?: boolean;

  @Prop({ type: String, trim: true })
  paymentMethod?: string;

  @Prop({
    type: String,
    enum: ['pending', 'issued', 'divergent', 'cancelled'],
    default: 'pending',
    index: true,
  })
  fiscalStatus!: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: [String], default: [] })
  attachments!: string[];
}

export const SalesOrderSchema = SchemaFactory.createForClass(SalesOrder);
SalesOrderSchema.index({ date: -1, status: 1 });
SalesOrderSchema.index({ orderNumber: 1, isDeleted: 1 });
