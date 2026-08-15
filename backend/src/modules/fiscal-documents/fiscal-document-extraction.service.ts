import { Injectable } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

export type ExtractedFiscalItem = {
  description: string;
  quantityKg?: number;
  unitPrice?: number;
  totalAmount?: number;
  quantityKgRaw?: string;
  unitPriceRaw?: string;
  totalAmountRaw?: string;
  quantityKgDecimalPlaces?: number;
  unitPriceDecimalPlaces?: number;
  totalAmountDecimalPlaces?: number;
};

export type ExtractedFiscalData = {
  items: ExtractedFiscalItem[];
  number?: string;
  accessKey?: string;
  amount?: number;
  amountRaw?: string;
  unitPrice?: number;
  unitPriceRaw?: string;
  totalWeightKg?: number;
  totalWeightRaw?: string;
  weightDecimalPlaces?: number;
  unitPriceDecimalPlaces?: number;
  amountDecimalPlaces?: number;
  method: 'xml' | 'ocr';
  confidence: number;
};

@Injectable()
export class FiscalDocumentExtractionService {
  extract(filePath: string, originalName: string): ExtractedFiscalData {
    const extension = originalName.toLowerCase().split('.').pop();
    const buffer = readFileSync(filePath);
    if (extension === 'xml') return this.extractXml(buffer.toString('utf8'));

    let text = '';
    if (extension === 'pdf') {
      try {
        text = execFileSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8', timeout: 120000 });
      } catch {
        // PDF escaneado sem camada de texto: tentar OCR abaixo.
      }
    }

    if (!text.trim()) {
      let ocrFilePath = filePath;
      let ocrDirectory: string | undefined;
      try {
        if (extension === 'pdf') {
          ocrDirectory = mkdtempSync(join(tmpdir(), 'agrovenda-nf-'));
          const imageBase = join(ocrDirectory, 'page');
          execFileSync('pdftoppm', ['-f', '1', '-l', '1', '-png', '-singlefile', filePath, imageBase], { timeout: 120000 });
          ocrFilePath = `${imageBase}.png`;
        }
        text = execFileSync('tesseract', [ocrFilePath, 'stdout', '-l', 'por+eng'], { encoding: 'utf8', timeout: 120000 });
      } catch {
        throw new Error('Leitura fiscal indisponível: instale pdftotext para PDFs textuais ou Tesseract para PDFs escaneados/imagens.');
      } finally {
        if (ocrDirectory) rmSync(ocrDirectory, { recursive: true, force: true });
      }
    }
    return this.extractText(text, 'ocr');
  }

  private extractXml(xml: string): ExtractedFiscalData {
    const itemBlocks = [...xml.matchAll(/<det[\s\S]*?<prod>([\s\S]*?)<\/prod>[\s\S]*?<\/det>/gi)].map((m) => m[1]);
    const items = itemBlocks.map((block) => ({
      description: this.tag(block, 'xProd') || 'Item da NF',
      quantityKgRaw: this.tag(block, 'qCom'),
      unitPriceRaw: this.tag(block, 'vUnCom'),
      totalAmountRaw: this.tag(block, 'vProd'),
      quantityKg: this.number(this.tag(block, 'qCom')),
      unitPrice: this.number(this.tag(block, 'vUnCom')),
      totalAmount: this.number(this.tag(block, 'vProd')),
      quantityKgDecimalPlaces: this.places(this.tag(block, 'qCom')),
      unitPriceDecimalPlaces: this.places(this.tag(block, 'vUnCom')),
      totalAmountDecimalPlaces: this.places(this.tag(block, 'vProd')),
    }));
    const amountRaw = this.tag(xml, 'vNF');
    const accessKey = xml.match(/Id="NFe(\d{44})"/i)?.[1];
    const totalWeightRaw = this.tag(xml, 'pesoL') || this.tag(xml, 'pesoB');
    return this.aggregate(items, 'xml', 1, this.tag(xml, 'nNF'), accessKey, amountRaw, totalWeightRaw);
  }

  private extractText(text: string, method: 'ocr'): ExtractedFiscalData {
    const amountRaw = this.findValue(text, /(valor\s+total|valor\s+da\s+nota|vNF)[^\d]*([\d.]+,\d{2,})/i);
    const unitPriceRaw = this.findValue(text, /(valor\s+unit[aá]rio|pre[cç]o\s+unit[aá]rio)[^\d]*([\d.]+,\d{2,})/i);
    const weightRaw = this.findValue(text, /(peso\s+l[ií]quido|quantidade|qCom)[^\d]*([\d.]+,\d{1,})/i);
    const item: ExtractedFiscalItem = {
      description: 'Item extraído por OCR', quantityKgRaw: weightRaw, unitPriceRaw, totalAmountRaw: amountRaw,
      quantityKg: this.number(weightRaw), unitPrice: this.number(unitPriceRaw), totalAmount: this.number(amountRaw),
      quantityKgDecimalPlaces: this.places(weightRaw), unitPriceDecimalPlaces: this.places(unitPriceRaw), totalAmountDecimalPlaces: this.places(amountRaw),
    };
    return this.aggregate([item], method, 0.6, this.findValue(text, /(n[úu]mero\s+da\s+nota|NF)[^\d]*(\d+)/i), undefined, amountRaw, weightRaw);
  }

  private aggregate(items: ExtractedFiscalItem[], method: 'xml' | 'ocr', confidence: number, number?: string, accessKey?: string, amountRaw?: string, totalWeightRaw?: string): ExtractedFiscalData {
    const valid = items.filter((i) => i.quantityKg !== undefined || i.totalAmount !== undefined);
    const totalWeightKg = this.number(totalWeightRaw) ?? valid.reduce((sum, i) => sum + (i.quantityKg || 0), 0);
    const amount = this.number(amountRaw) ?? valid.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const first = valid.find((i) => i.unitPrice !== undefined);
    return { items, number, accessKey, amount, amountRaw, unitPrice: first?.unitPrice, unitPriceRaw: first?.unitPriceRaw, totalWeightKg, totalWeightRaw, weightDecimalPlaces: this.places(totalWeightRaw) ?? Math.max(...items.map(i => i.quantityKgDecimalPlaces || 0), 0), unitPriceDecimalPlaces: first?.unitPriceDecimalPlaces, amountDecimalPlaces: this.places(amountRaw), method, confidence };
  }

  private tag(source: string, name: string) { return source.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, 'i'))?.[1]?.trim(); }
  private findValue(source: string, expression: RegExp) { return source.match(expression)?.[2]?.trim(); }
  private number(value?: string) { if (!value) return undefined; const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value; const result = Number(normalized); return Number.isFinite(result) ? result : undefined; }
  private places(value?: string) { return value ? (value.includes(',') ? value.split(',')[1].length : value.split('.')[1]?.length || 0) : undefined; }
}
