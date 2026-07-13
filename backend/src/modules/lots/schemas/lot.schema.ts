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

  @Prop({ required: true, min: 0 })
  quantityBags!: number;

  @Prop({ min: 0, default: 25 })
  bagWeightKg!: number;

  @Prop({ required: true, min: 0 })
  quantityKg!: number;

  @Prop({ required: true, trim: true })
  cropYear!: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ enum: LOT_STATUSES, default: 'available', index: true })
  status!: LotStatus;

  @Prop({ trim: true })
  notes?: string;
}

export const LotSchema = SchemaFactory.createForClass(Lot);
LotSchema.index({ producerId: 1, productId: 1, status: 1 });
