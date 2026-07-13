import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProducerDto } from './dto/create-producer.dto';
import { UpdateProducerDto } from './dto/update-producer.dto';
import { Producer } from './schemas/producer.schema';

@Injectable()
export class ProducersService {
  constructor(@InjectModel(Producer.name) private readonly producerModel: Model<Producer>) {}

  findAll() {
    return this.producerModel.find({ isDeleted: false }).sort({ name: 1 }).lean();
  }

  async create(dto: CreateProducerDto) {
    const existing = await this.producerModel.findOne({ documentNumber: dto.documentNumber, isDeleted: false });
    if (existing) {
      throw new ConflictException('Produtor ja cadastrado com este documento.');
    }
    return this.producerModel.create(dto);
  }

  async update(id: string, dto: UpdateProducerDto) {
    const updated = await this.producerModel
      .findOneAndUpdate({ _id: id, isDeleted: false }, dto, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Produtor nao encontrado.');
    }
    return updated;
  }

  async softDelete(id: string) {
    const deleted = await this.producerModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { active: false, isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .lean();
    if (!deleted) {
      throw new NotFoundException('Produtor nao encontrado.');
    }
    return { ok: true };
  }
}
