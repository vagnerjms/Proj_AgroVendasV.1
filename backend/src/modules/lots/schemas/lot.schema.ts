import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type LotDocument = HydratedDocument<Lot>;

export const LOT_STATUSES = ['available', 'reserved', 'sold'] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

@Schema({ timestamps: true })
export class Lot extends AuditableSchema {
  @Prop({ type: Types.ObjectId, ref: 'Producer', required: true, index: true })
  producerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  quantityBags!: number;

  @Prop({ type: Number, min: 0, default: 25 })
  bagWeightKg!: number;

  @Prop({ type: Number, required: true, min: 0 })
  quantityKg!: number;

  @Prop({ type: String, required: true, trim: true })
  cropYear!: string;

  @Prop({ type: String, trim: true })
  location?: string;

  @Prop({ type: String, enum: LOT_STATUSES, default: 'available', index: true })
  status!: LotStatus;

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const LotSchema = SchemaFactory.createForClass(Lot);
LotSchema.index({ producerId: 1, productId: 1, status: 1 });
