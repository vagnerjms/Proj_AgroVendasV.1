import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from './schemas/counter.schema';

@Injectable()
export class CountersService {
  constructor(@InjectModel(Counter.name) private readonly counterModel: Model<Counter>) {}

  async nextCode(key: string, prefix: string, padLength = 3) {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { key },
        { $inc: { seq: 1 }, $setOnInsert: { key } },
        { new: true, upsert: true, setDefaultsOnInsert: true, lean: true },
      )
      .exec();

    if (!counter) {
      throw new Error(`Nao foi possivel gerar contador para a chave ${key}.`);
    }

    return `${prefix}${String(counter.seq).padStart(padLength, '0')}`;
  }
}
