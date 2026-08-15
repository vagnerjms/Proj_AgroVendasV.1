import 'reflect-metadata';
import { connect, model, Schema, Types } from 'mongoose';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join, relative } from 'path';
import { FiscalDocumentExtractionService } from '../modules/fiscal-documents/fiscal-document-extraction.service';

type ManifestEntry = { number?: string; sourceFile?: string; orderNumber?: string; salesOrderId?: string };

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/agrovenda_broker';
const importDir = process.env.FISCAL_IMPORT_DIR || join(process.cwd(), 'import', 'storage', 'fiscal-documents');
const manifestPath = process.env.FISCAL_IMPORT_MANIFEST || join(process.cwd(), 'import', 'fiscal-reconciliation.json');
const databasePath = process.env.FISCAL_IMPORT_DATABASE_JSON || join(process.cwd(), 'import', 'database.json');
const outputDir = process.env.FISCAL_IMPORT_OUTPUT || join(process.cwd(), 'import', 'output');

const FiscalDocument = model('FiscalDocument', new Schema({}, { strict: false }), 'fiscaldocuments');
const SalesOrder = model('SalesOrder', new Schema({}, { strict: false }), 'salesorders');
const extraction = new FiscalDocumentExtractionService();

function numberFromFile(name: string) {
  return name.match(/(?:^|-)(\d{8})(?:-|\.|$)/)?.[1];
}

function listPdfFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    return entry.isDirectory() ? listPdfFiles(filePath) : extname(entry.name).toLowerCase() === '.pdf' ? [filePath] : [];
  });
}

function safeDate(value: unknown) {
  return value instanceof Date ? value : new Date();
}

async function main() {
  if (process.env.FISCAL_IMPORT_ON_STARTUP === 'false' || !existsSync(importDir)) {
    return;
  }

  await connect(uri);
  mkdirSync(outputDir, { recursive: true });
  const manifest: { documents?: ManifestEntry[] } = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {};
  const backupDatabase = existsSync(databasePath) ? JSON.parse(readFileSync(databasePath, 'utf8')) : {};
  const backupEntries: ManifestEntry[] = (backupDatabase.data?.fiscaldocuments || []).map((doc: any) => ({
    number: doc.number,
    orderNumber: doc.orderNumber,
    salesOrderId: doc.salesOrderId?.$oid || doc.salesOrderId,
  }));
  const entries = [...(manifest.documents || []), ...backupEntries];
  const report: any[] = [];
  const processed = new Set<string>();

  for (const sourcePath of listPdfFiles(importDir)) {
    const sourceFile = sourcePath.split(/[\\/]/).pop() || sourcePath;
    const relativePath = relative(importDir, sourcePath).replace(/\\/g, '/');
    const directoryOrderNumber = relativePath.split('/')[0]?.match(/^VP\d+$/i)?.[0]?.toUpperCase();
    const numberFromName = numberFromFile(sourceFile);
    const entry = entries.find((item) => item.sourceFile === sourceFile || item.number === numberFromName || item.orderNumber === directoryOrderNumber);
    const number = numberFromName || entry?.number;
    const uniqueKey = `${entry?.orderNumber || directoryOrderNumber || ''}:${number || sourceFile}`;
    if (processed.has(uniqueKey)) {
      report.push({ sourceFile, number, orderNumber: directoryOrderNumber, status: 'review_required', reason: 'PDF duplicado para o mesmo pedido/NF' });
      continue;
    }
    processed.add(uniqueKey);
    const existing = await FiscalDocument.findOne({
      ...(number ? { number } : { orderNumber: entry?.orderNumber || directoryOrderNumber }),
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    }).lean() as any;
    const orderId = entry?.salesOrderId || existing?.salesOrderId?.toString();
    const order = orderId
      ? await SalesOrder.findOne({ _id: new Types.ObjectId(orderId) }).lean() as any
      : await SalesOrder.findOne({ orderNumber: entry?.orderNumber }).lean() as any;

    if (!number || !order) {
      report.push({ sourceFile, number, status: 'review_required', reason: 'NF sem vínculo confirmado na tela fiscal' });
      continue;
    }

    const orderNumber = order.orderNumber;
    const storageDir = join(process.cwd(), 'storage', 'fiscal-documents', orderNumber);
    mkdirSync(storageDir, { recursive: true });
    const storedPath = join(storageDir, sourceFile);
    if (existing?.totalWeightKg && existing?.unitPrice !== undefined && existing.files?.some((file: any) => file.originalName === sourceFile)) {
      report.push({ sourceFile, number, orderNumber, status: 'already_imported' });
      continue;
    }

    let extracted;
    try {
      extracted = extraction.extract(sourcePath, sourceFile);
    } catch (error: any) {
      report.push({ sourceFile, number, orderNumber: order.orderNumber, status: 'review_required', reason: error?.message || 'Falha na extração fiscal' });
      continue;
    }
    const reviewRequired = extracted.confidence < 0.8 || extracted.amount === undefined || extracted.totalWeightKg === undefined || extracted.unitPrice === undefined;
    if (!existsSync(storedPath)) copyFileSync(sourcePath, storedPath);

    const previous = existing ? {
      number: existing.number,
      amount: existing.amount,
      totalWeightKg: existing.totalWeightKg,
      unitPrice: existing.unitPrice,
      status: existing.status,
    } : null;
    const now = safeDate(new Date());
    const fileMeta = { kind: 'danfe_pdf', originalName: sourceFile, mimeType: 'application/pdf', size: readFileSync(sourcePath).length, storagePath: storedPath, uploadedAt: now };
    const fiscalPayload = {
      salesOrderId: order._id,
      orderNumber,
      number,
      amount: extracted.amount ?? existing?.amount,
      amountRaw: extracted.amountRaw,
      totalWeightKg: extracted.totalWeightKg ?? existing?.totalWeightKg,
      totalWeightRaw: extracted.totalWeightRaw,
      unitPrice: extracted.unitPrice ?? existing?.unitPrice,
      unitPriceRaw: extracted.unitPriceRaw,
      items: extracted.items,
      weightDecimalPlaces: extracted.weightDecimalPlaces,
      unitPriceDecimalPlaces: extracted.unitPriceDecimalPlaces,
      amountDecimalPlaces: extracted.amountDecimalPlaces,
      extractionMethod: extracted.method,
      extractionConfidence: extracted.confidence,
      status: reviewRequired ? 'divergent' : 'issued',
      updatedAt: now,
    } as any;
    await FiscalDocument.updateOne(
      { _id: existing?._id || new Types.ObjectId() },
      { $set: fiscalPayload, $setOnInsert: { createdAt: now }, $addToSet: { files: fileMeta }, $push: { auditHistory: { changedAt: now, source: 'fiscal-folder-import', previous, extracted: fiscalPayload } } },
      { upsert: true },
    );

    if (!reviewRequired) {
      await SalesOrder.updateOne({ _id: order._id }, {
        $set: { fiscalWeightKg: extracted.totalWeightKg, fiscalUnitPrice: extracted.unitPrice, fiscalTotalAmount: extracted.amount, fiscalBoxQuantity: (extracted.totalWeightKg || 0) / 29, fiscalBoxQuote: (extracted.totalWeightKg || 0) * (extracted.unitPrice || 0), fiscalValueSource: 'fiscal_document' },
        $push: { fiscalAuditHistory: { changedAt: now, source: 'fiscal-folder-import', previous, extracted: { totalWeightKg: extracted.totalWeightKg, unitPrice: extracted.unitPrice, amount: extracted.amount } } },
      });
    }
    report.push({ sourceFile, number, orderNumber, status: reviewRequired ? 'review_required' : 'applied', confidence: extracted.confidence, weight: extracted.totalWeightKg, unitPrice: extracted.unitPrice, amount: extracted.amount });
  }

  writeFileSync(join(outputDir, 'fiscal-reconciliation-result.json'), JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: false, report }, null, 2));
  await FiscalDocument.db.close();
}

main().catch(async (error) => {
  console.error('Fiscal folder import failed:', error);
  await FiscalDocument.db.close();
  process.exitCode = 1;
});
