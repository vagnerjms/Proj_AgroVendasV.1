import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';
import { Lot, LotSchema } from './schemas/lot.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Lot.name, schema: LotSchema }])],
  controllers: [LotsController],
  providers: [LotsService],
  exports: [LotsService, MongooseModule],
})
export class LotsModule {}
