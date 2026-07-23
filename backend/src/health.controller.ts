import { Controller, Get, Post, Param, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('health')
export class HealthController {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'pdfs');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'agrovenda-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file'))
  uploadPdf(@UploadedFile() file: any) {
    if (!file) {
      return { error: 'Nenhum arquivo enviado.' };
    }
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const targetPath = path.join(this.uploadDir, uniqueName);
    
    fs.writeFileSync(targetPath, file.buffer);
    
    return { filename: uniqueName };
  }

  @Get('pdf/:filename')
  async getPdf(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(this.uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Arquivo nao encontrado.');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
