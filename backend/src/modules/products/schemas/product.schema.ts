import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product extends AuditableSchema {
  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  @Prop({ type: String, trim: true, index: true })
  category?: string;

  @Prop({ type: String, trim: true })
  variety?: string;

  @Prop({ type: String, required: true, enum: ['kg', 'caixa', 'saco', 'saca', 'tonelada', 'unidade', 'pacote'], default: 'caixa' })
  defaultUnit!: string;

  @Prop({ type: Number, default: 20, min: 0 })
  defaultWeightKg?: number;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;

  @Prop({ type: String, required: true, trim: true, unique: true, index: true })
  internalCode!: string;

  @Prop({ type: Boolean, default: false })
  marketReferenceEnabled!: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ name: 1, isDeleted: 1 });
