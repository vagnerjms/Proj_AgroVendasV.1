import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

@Schema({ timestamps: true })
export class Counter {
  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  key!: string;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  seq!: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
