import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { HydratedDocument } from 'mongoose';
import { AuditableSchema } from '../../../common/schemas/auditable.schema';
import { USER_ROLES, UserRole } from '../user-role';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User extends AuditableSchema {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ type: String, required: true, select: false })
  passwordHash!: string;

  @Prop({ type: String, required: true, enum: USER_ROLES, default: 'broker', index: true })
  role!: UserRole;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop({ type: Date })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  const value = this.get('passwordHash') as string;
  if (value.startsWith('$2a$') || value.startsWith('$2b$')) {
    return next();
  }

  this.set('passwordHash', await bcrypt.hash(value, 12));
  next();
});
