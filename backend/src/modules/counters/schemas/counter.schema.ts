import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

@Schema({ timestamps: true })
export class Counter {
  @Prop({ required: true, unique: true, index: true, trim: true })
  key!: string;

  @Prop({ required: true, default: 0, min: 0 })
  seq!: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
