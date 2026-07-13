import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { LotsService } from './lots.service';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtGuard)
@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Post()
  create(@Body() createLotDto: CreateLotDto, @Request() req: any) {
    return this.lotsService.create(createLotDto, req.user);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.lotsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lotsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLotDto: UpdateLotDto, @Request() req: any) {
    return this.lotsService.update(id, updateLotDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.lotsService.remove(id, req.user);
  }
}
