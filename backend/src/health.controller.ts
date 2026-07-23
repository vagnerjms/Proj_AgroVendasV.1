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

  private cleanOldFiles() {
    try {
      const now = Date.now();
      const files = fs.readdirSync(this.uploadDir);
      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = fs.statSync(filePath);
        const fileAgeMs = now - stats.mtimeMs;
        // Se o arquivo tiver mais de 24 horas (86400000 ms)
        if (fileAgeMs > 86400000) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error('Erro ao limpar arquivos PDF antigos:', err);
    }
  }

  @Post('upload-pdf')
  @UseInterceptors(FileInterceptor('file'))
  uploadPdf(@UploadedFile() file: any) {
    this.cleanOldFiles();

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

    // Deletar o PDF temporário imediatamente após o envio da transmissão ser finalizado
    fileStream.on('close', () => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Erro ao excluir arquivo PDF temporario:', err);
      }
    });
  }
}
