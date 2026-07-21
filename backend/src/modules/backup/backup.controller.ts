import { Body, Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  async createBackup() {
    return this.backupService.createBackup();
  }

  @Get('list')
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get('download/:filename')
  async downloadBackup(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.backupService.getBackupFilePath(filename);
    return res.download(filePath, filename);
  }

  @Post('restore/:filename')
  async restoreBackup(@Param('filename') filename: string) {
    return this.backupService.restoreBackup(filename);
  }

  @Post('upload-restore')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndRestore(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('Nenhum arquivo enviado.');
    }
    const content = file.buffer.toString('utf-8');
    return this.backupService.restoreBackup(file.originalname, content);
  }
}
