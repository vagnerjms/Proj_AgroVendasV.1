import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import * as fs from 'fs';
import { Connection } from 'mongoose';
import * as path from 'path';

export interface BackupFileInfo {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  collectionsCount: number;
  totalRecords: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.join(process.cwd(), 'backups');

  constructor(@InjectConnection() private readonly connection: Connection) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(): Promise<BackupFileInfo> {
    const collections = await this.connection.db?.listCollections().toArray() || [];
    const backupData: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      const docs = await this.connection.db?.collection(col.name).find({}).toArray() || [];
      backupData[col.name] = docs;
      totalRecords += docs.length;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `agrovenda_backup_${timestamp}.json`;
    const filePath = path.join(this.backupDir, filename);

    const jsonContent = JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      database: this.connection.name,
      collectionsCount: Object.keys(backupData).length,
      totalRecords,
      data: backupData,
    }, null, 2);

    fs.writeFileSync(filePath, jsonContent, 'utf-8');
    const stats = fs.statSync(filePath);

    this.logger.log(`Backup criado com sucesso: ${filename} (${totalRecords} registros)`);

    return {
      filename,
      createdAt: new Date().toISOString(),
      sizeBytes: stats.size,
      collectionsCount: Object.keys(backupData).length,
      totalRecords,
    };
  }

  async listBackups(): Promise<BackupFileInfo[]> {
    if (!fs.existsSync(this.backupDir)) return [];

    const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.json'));
    const result: BackupFileInfo[] = [];

    for (const file of files) {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        result.push({
          filename: file,
          createdAt: content.timestamp || stats.birthtime.toISOString(),
          sizeBytes: stats.size,
          collectionsCount: content.collectionsCount || (content.data ? Object.keys(content.data).length : 0),
          totalRecords: content.totalRecords || 0,
        });
      } catch (err) {
        result.push({
          filename: file,
          createdAt: stats.birthtime.toISOString(),
          sizeBytes: stats.size,
          collectionsCount: 0,
          totalRecords: 0,
        });
      }
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getBackupFilePath(filename: string): string {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.backupDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      throw new Error('Arquivo de backup não encontrado.');
    }
    return filePath;
  }

  async restoreBackup(filename: string, fileContent?: string): Promise<{ success: boolean; restoredCollections: number; totalRestoredRecords: number }> {
    let backupJson: any;

    if (fileContent) {
      backupJson = JSON.parse(fileContent);
    } else {
      const filePath = this.getBackupFilePath(filename);
      backupJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    if (!backupJson || !backupJson.data) {
      throw new Error('Estrutura de arquivo de backup inválida.');
    }

    const data: Record<string, any[]> = backupJson.data;
    let restoredCollections = 0;
    let totalRestoredRecords = 0;

    for (const [colName, docs] of Object.entries(data)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;

      const collection = this.connection.db?.collection(colName);
      if (!collection) continue;

      // Limpar coleção atual para restauração limpa
      await collection.deleteMany({});

      // Inserir registros mantendo os _ids originais
      const formattedDocs = docs.map(doc => {
        if (doc._id && typeof doc._id === 'string' && doc._id.length === 24) {
          try {
            const { ObjectId } = require('mongodb');
            doc._id = new ObjectId(doc._id);
          } catch (e) {
            // Manter string se não for ObjectId válido
          }
        }
        return doc;
      });

      await collection.insertMany(formattedDocs);
      restoredCollections++;
      totalRestoredRecords += docs.length;
    }

    this.logger.log(`Restauração concluída: ${restoredCollections} coleções, ${totalRestoredRecords} registros.`);

    return {
      success: true,
      restoredCollections,
      totalRestoredRecords,
    };
  }
}
