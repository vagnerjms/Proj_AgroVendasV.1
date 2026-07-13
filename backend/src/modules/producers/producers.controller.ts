import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProducerDto } from './dto/create-producer.dto';
import { UpdateProducerDto } from './dto/update-producer.dto';
import { ProducersService } from './producers.service';

@Controller('producers')
export class ProducersController {
  constructor(private readonly producersService: ProducersService) {}

  @Get()
  findAll() {
    return this.producersService.findAll();
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateProducerDto) {
    return this.producersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateProducerDto) {
    return this.producersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.producersService.softDelete(id);
  }
}
