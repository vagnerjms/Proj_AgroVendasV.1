import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lot, LotDocument } from './schemas/lot.schema';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';

@Injectable()
export class LotsService {
  constructor(
    @InjectModel(Lot.name) private readonly lotModel: Model<LotDocument>,
  ) {}

  async create(createLotDto: CreateLotDto, user: any): Promise<LotDocument> {
    const bagWeightKg = createLotDto.bagWeightKg || 25;
    const quantityKg = createLotDto.quantityBags * bagWeightKg;

    const createdLot = new this.lotModel({
      ...createLotDto,
      bagWeightKg,
      quantityKg,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return createdLot.save();
  }

  async findAll(query: any = {}): Promise<LotDocument[]> {
    const filter: any = { isDeleted: false };
    if (query.producerId) filter.producerId = query.producerId;
    if (query.productId) filter.productId = query.productId;
    if (query.status) filter.status = query.status;

    return this.lotModel.find(filter)
      .populate('producerId', 'name documentType documentNumber')
      .populate('productId', 'name description')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<LotDocument> {
    const lot = await this.lotModel.findOne({ _id: id, isDeleted: false })
      .populate('producerId')
      .populate('productId')
      .exec();
      
    if (!lot) {
      throw new NotFoundException(`Lot #${id} not found`);
    }
    return lot;
  }

  async update(id: string, updateLotDto: UpdateLotDto, user: any): Promise<LotDocument> {
    let quantityKg;
    if (updateLotDto.quantityBags !== undefined) {
      const existing = await this.findOne(id);
      const bagWeightKg = updateLotDto.bagWeightKg || existing.bagWeightKg;
      quantityKg = updateLotDto.quantityBags * bagWeightKg;
    }

    const lot = await this.lotModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { 
        ...updateLotDto, 
        ...(quantityKg !== undefined ? { quantityKg } : {}),
        updatedBy: user.sub,
        updatedAt: new Date()
      },
      { new: true },
    ).exec();

    if (!lot) {
      throw new NotFoundException(`Lot #${id} not found`);
    }
    return lot;
  }

  async remove(id: string, user: any): Promise<LotDocument> {
    const lot = await this.lotModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { 
        isDeleted: true, 
        deletedAt: new Date(),
        updatedBy: user.sub 
      },
      { new: true },
    ).exec();

    if (!lot) {
      throw new NotFoundException(`Lot #${id} not found`);
    }
    return lot;
  }
}
