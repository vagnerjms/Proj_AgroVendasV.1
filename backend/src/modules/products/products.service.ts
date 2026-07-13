import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<Product>) {}

  findAll() {
    return this.productModel.find({ isDeleted: false }).sort({ name: 1 }).lean();
  }

  async create(dto: CreateProductDto) {
    const existing = await this.productModel.findOne({
      isDeleted: false,
      $or: [{ internalCode: dto.internalCode }, { name: dto.name }],
    });
    if (existing) {
      throw new ConflictException('Produto ja cadastrado com este nome ou codigo interno.');
    }
    return this.productModel.create(dto);
  }

  async update(id: string, dto: UpdateProductDto) {
    const updated = await this.productModel
      .findOneAndUpdate({ _id: id, isDeleted: false }, dto, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Produto nao encontrado.');
    }
    return updated;
  }

  async softDelete(id: string) {
    const deleted = await this.productModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { active: false, isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .lean();
    if (!deleted) {
      throw new NotFoundException('Produto nao encontrado.');
    }
    return { ok: true };
  }
}
