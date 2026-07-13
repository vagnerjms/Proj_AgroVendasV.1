import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import { UpdateFiscalDocumentDto } from './dto/update-fiscal-document.dto';
import { FiscalDocumentsService } from './fiscal-documents.service';

const allowedMimeTypes = new Set(['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpg', 'image/jpeg']);

@Controller('fiscal-documents')
@UseGuards(JwtGuard, RolesGuard)
export class FiscalDocumentsController {
  constructor(private readonly fiscalDocumentsService: FiscalDocumentsService) {}

  @Get()
  @Roles('accountant', 'financial')
  findAll(
    @Query()
    query: {
      orderNumber?: string;
      customerId?: string;
      producerId?: string;
      number?: string;
      accessKey?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    return this.fiscalDocumentsService.findAll(query);
  }

  @Get('alerts')
  @Roles('accountant', 'financial')
  alerts() {
    return this.fiscalDocumentsService.alerts();
  }

  @Get(':id')
  @Roles('accountant', 'financial')
  findOne(@Param('id') id: string) {
    return this.fiscalDocumentsService.findOne(id);
  }

  @Post()
  @Roles('accountant')
  create(@Body() dto: CreateFiscalDocumentDto) {
    return this.fiscalDocumentsService.create(dto);
  }

  @Patch(':id')
  @Roles('accountant')
  update(@Param('id') id: string, @Body() dto: UpdateFiscalDocumentDto) {
    return this.fiscalDocumentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('accountant')
  remove(@Param('id') id: string) {
    return this.fiscalDocumentsService.remove(id);
  }

  @Post(':id/files')
  @Roles('accountant')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request: Express.Request, _file: Express.Multer.File, callback) =>
          callback(null, FiscalDocumentsService.ensureTempStorage()),
        filename: (_request: Express.Request, file: Express.Multer.File, callback) =>
          callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`),
      }),
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(new BadRequestException('Formato de arquivo fiscal nao permitido.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  attachFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.fiscalDocumentsService.attachFile(id, file);
  }

  @Get(':id/files/:fileId/download')
  @Roles('accountant', 'financial')
  async download(@Param('id') id: string, @Param('fileId') fileId: string, @Res() response: Response) {
    const file = await this.fiscalDocumentsService.getFilePath(id, fileId);
    return response.download(file.storagePath, file.originalName);
  }
}
