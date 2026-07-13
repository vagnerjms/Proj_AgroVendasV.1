import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true })
export class Customer extends AuditableSchema {
  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  @Prop({ type: String, required: true, enum: ['cpf', 'cnpj'] })
  documentType!: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  documentNumber!: string;

  @Prop({ type: String, trim: true })
  stateRegistration?: string;

  @Prop({ type: String, trim: true })
  deliveryAddress?: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  city!: string;

  @Prop({ type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 2, index: true })
  state!: string;

  @Prop({ type: String, trim: true })
  whatsapp?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  creditLimit!: number;

  @Prop({ type: String, enum: ['ok', 'watch', 'blocked'], default: 'ok', index: true })
  financialStatus!: string;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ documentNumber: 1, isDeleted: 1 }, { unique: true });
