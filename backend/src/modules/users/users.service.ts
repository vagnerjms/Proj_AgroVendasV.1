import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  findAll() {
    return this.userModel.find({ isDeleted: false }).select('-passwordHash').sort({ name: 1 }).lean();
  }

  findById(id: string) {
    return this.userModel.findOne({ _id: id, isDeleted: false }).select('-passwordHash').lean();
  }

  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase(), isDeleted: false, active: true })
      .select('+passwordHash');
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase(), isDeleted: false });
    if (existing) {
      throw new ConflictException('Usuario ja cadastrado com este e-mail.');
    }

    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash: dto.password,
      role: dto.role,
      active: dto.active,
      permissions: dto.permissions || [],
    });

    return this.sanitize(user.toObject());
  }

  async update(id: string, dto: UpdateUserDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.password) {
      update.passwordHash = dto.password;
      delete update.password;
    }

    const user = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    user.set(update);
    await user.save();
    return this.sanitize(user.toObject());
  }

  async touchLastLogin(id: string) {
    await this.userModel.updateOne({ _id: id }, { lastLoginAt: new Date() });
  }

  async softDelete(id: string) {
    const deleted = await this.userModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { active: false, isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .lean();
    if (!deleted) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return { ok: true };
  }

  sanitize(user: object) {
    const safeUser = { ...(user as Record<string, unknown>) };
    delete safeUser.passwordHash;
    return safeUser;
  }
}
