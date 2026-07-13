import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Res, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CalculateSalesOrderDto } from './dto/calculate-sales-order.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrdersService } from './sales-orders.service';
import { PdfService } from './pdf.service';

const allowedMimeTypes = new Set(['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpg', 'image/jpeg']);

@Controller('sales-orders')
export class SalesOrdersController {
  constructor(
    private readonly salesOrdersService: SalesOrdersService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll(@Query() query: { orderNumber?: string; customer?: string; producer?: string; date?: string; status?: string; page?: string; limit?: string }) {
    return this.salesOrdersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesOrdersService.findOne(id);
  }

  @Get(':id/contract')
  async downloadContract(@Param('id') id: string, @Res() res: any) {
    const order = await this.salesOrdersService.findOne(id) as any;
    const pdfBuffer = await this.pdfService.generateContract(order);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contrato-${order.orderNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('calculate')
  calculate(@Body() dto: CalculateSalesOrderDto) {
    return this.salesOrdersService.calculate(dto);
  }

  @Post('draft')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('broker')
  createDraft(@Body() body: { date?: string } = {}) {
    return this.salesOrdersService.createDraft(body.date);
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('broker')
  create(@Body() dto: CreateSalesOrderDto) {
    return this.salesOrdersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('broker')
  update(@Param('id') id: string, @Body() dto: UpdateSalesOrderDto) {
    return this.salesOrdersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('broker')
  remove(@Param('id') id: string) {
    return this.salesOrdersService.softDelete(id);
  }

  @Post(':id/files')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('broker')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request: Express.Request, _file: Express.Multer.File, callback) =>
          callback(null, SalesOrdersService.ensureTempStorage()),
        filename: (_request: Express.Request, file: Express.Multer.File, callback) =>
          callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`),
      }),
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(new BadRequestException('Formato de arquivo não permitido.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  attachFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.salesOrdersService.attachFile(id, file);
  }

  @Get(':id/files/:filename')
  @UseGuards(JwtGuard, RolesGuard)
  downloadFile(@Param('id') id: string, @Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.salesOrdersService.getFilePath(id, filename);
    res.download(filePath);
  }

  @Delete(':id/files/:filename')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('broker')
  removeFile(@Param('id') id: string, @Param('filename') filename: string) {
    return this.salesOrdersService.removeFile(id, filename);
  }
}
