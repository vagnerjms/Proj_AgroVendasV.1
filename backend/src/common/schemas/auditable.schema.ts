import { Prop } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export abstract class AuditableSchema {
  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date, index: true })
  deletedAt?: Date;
}
