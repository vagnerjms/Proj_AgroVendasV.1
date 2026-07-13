import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProducersController } from './producers.controller';
import { ProducersService } from './producers.service';
import { Producer, ProducerSchema } from './schemas/producer.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Producer.name, schema: ProducerSchema }])],
  controllers: [ProducersController],
  providers: [ProducersService],
  exports: [ProducersService, MongooseModule],
})
export class ProducersModule {}
