import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';

export type ProducerDocument = HydratedDocument<Producer>;

@Schema({ timestamps: true })
export class Producer extends AuditableSchema {
  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  @Prop({ type: String, required: true, enum: ['cpf', 'cnpj'] })
  documentType!: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  documentNumber!: string;

  @Prop({ type: String, trim: true })
  stateRegistration?: string;

  @Prop({ type: String, trim: true })
  ruralRegistration?: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  city!: string;

  @Prop({ type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 2, index: true })
  state!: string;

  @Prop({ type: String, trim: true })
  pixKey?: string;

  @Prop({ type: Object })
  bankInfo?: Record<string, unknown>;

  @Prop({ type: Object, default: { enabled: false, rate: 0 } })
  funruralConfig!: { enabled: boolean; rate: number };

  @Prop({ type: Object })
  accountantContact?: Record<string, unknown>;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;
}

export const ProducerSchema = SchemaFactory.createForClass(Producer);
ProducerSchema.index({ documentNumber: 1, isDeleted: 1 }, { unique: true });
