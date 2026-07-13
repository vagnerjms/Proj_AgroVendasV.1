import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './schemas/customer.schema';

@Injectable()
export class CustomersService {
  constructor(@InjectModel(Customer.name) private readonly customerModel: Model<Customer>) {}

  findAll() {
    return this.customerModel.find({ isDeleted: false }).sort({ name: 1 }).lean();
  }

  async create(dto: CreateCustomerDto) {
    const existing = await this.customerModel.findOne({ documentNumber: dto.documentNumber, isDeleted: false });
    if (existing) {
      throw new ConflictException('Cliente ja cadastrado com este documento.');
    }
    return this.customerModel.create(dto);
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const updated = await this.customerModel
      .findOneAndUpdate({ _id: id, isDeleted: false }, dto, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Cliente nao encontrado.');
    }
    return updated;
  }

  async softDelete(id: string) {
    const deleted = await this.customerModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { active: false, isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .lean();
    if (!deleted) {
      throw new NotFoundException('Cliente nao encontrado.');
    }
    return { ok: true };
  }
}
