import 'reflect-metadata';
import { connect, connection, model, Schema, Types } from 'mongoose';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/agrovenda';
const apply = process.argv.includes('--apply');
const backupDir = join(process.cwd(), 'backups');

const FiscalDocument = model('FiscalDocument', new Schema({}, { strict: false, collection: 'fiscaldocuments' }));
const SalesOrder = model('SalesOrder', new Schema({}, { strict: false, collection: 'salesorders' }));

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value);
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function places(value: unknown) {
  const text = String(value ?? '');
  return text.includes(',') ? text.split(',')[1].length : text.split('.')[1]?.length || 0;
}

function tag(source: string, name: string) {
  return source.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, 'i'))?.[1]?.trim();
}

async function main() {
  await connect(uri);
  const fiscalDocs = await FiscalDocument.find({ isDeleted: false }).lean();
  const orders = await SalesOrder.find({ isDeleted: false, orderNumber: /^97/ }).lean();
  const report: any[] = [];

  if (apply) {
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const collections: Record<string, unknown[]> = {};
    for (const info of await connection.db!.listCollections().toArray()) {
      if (!info.name.startsWith('system.')) collections[info.name] = await connection.db!.collection(info.name).find({}).toArray();
    }
    writeFileSync(join(backupDir, `fiscal-reconcile-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ collections, fiscalDocs, orders }, null, 2));
  }

  for (const doc of fiscalDocs as any[]) {
    const files = doc.files || [];
    const xml = files.find((file: any) => file.kind === 'xml' && existsSync(file.storagePath));
    if (!xml) {
      report.push({ orderNumber: doc.orderNumber, status: 'sem_xml', files: files.length });
      continue;
    }
    const source = readFileSync(xml.storagePath, 'utf8');
    const items = [...source.matchAll(/<det[\s\S]*?<prod>([\s\S]*?)<\/prod>[\s\S]*?<\/det>/gi)].map((match) => {
      const block = match[1];
      const quantityRaw = tag(block, 'qCom');
      const unitRaw = tag(block, 'vUnCom');
      const totalRaw = tag(block, 'vProd');
      return { description: tag(block, 'xProd') || 'Item da NF', quantityKg: parseNumber(quantityRaw), unitPrice: parseNumber(unitRaw), totalAmount: parseNumber(totalRaw), quantityKgRaw: quantityRaw, unitPriceRaw: unitRaw, totalAmountRaw: totalRaw, quantityKgDecimalPlaces: places(quantityRaw), unitPriceDecimalPlaces: places(unitRaw), totalAmountDecimalPlaces: places(totalRaw) };
    });
    const amountRaw = tag(source, 'vNF');
    const amount = parseNumber(amountRaw) ?? items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const weight = items.reduce((sum, item) => sum + (item.quantityKg || 0), 0);
    const unitPrice = items.find((item) => item.unitPrice !== undefined)?.unitPrice;
    const number = tag(source, 'nNF') || doc.number;
    const accessKey = source.match(/Id="NFe(\d{44})"/i)?.[1] || doc.accessKey;
    const update = { $set: { items, amount, amountRaw, totalWeightKg: weight, unitPrice, unitPriceRaw: items.find((item) => item.unitPriceRaw)?.unitPriceRaw, number, accessKey, extractionMethod: 'xml', extractionConfidence: 1, weightDecimalPlaces: Math.max(...items.map((item) => item.quantityKgDecimalPlaces || 0), 0), unitPriceDecimalPlaces: items.find((item) => item.unitPriceDecimalPlaces !== undefined)?.unitPriceDecimalPlaces, amountDecimalPlaces: places(amountRaw), extractionError: undefined, status: 'issued' } };
    report.push({ orderNumber: doc.orderNumber, number, amount, weight, unitPrice, status: apply ? 'aplicado' : 'preview' });
    if (apply) {
      await FiscalDocument.updateOne({ _id: doc._id }, update);
      if (doc.salesOrderId) await SalesOrder.updateOne({ _id: new Types.ObjectId(String(doc.salesOrderId)) }, { $set: { fiscalWeightKg: weight, fiscalUnitPrice: unitPrice, fiscalTotalAmount: amount, fiscalBoxQuantity: weight / 29, fiscalBoxQuote: unitPrice === undefined ? undefined : unitPrice * 29, fiscalValueSource: 'fiscal_document' } });
    }
  }

  const output = join(backupDir, `fiscal-reconcile-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(output, JSON.stringify({ dryRun: !apply, orderCount: orders.length, report }, null, 2));
  console.log(JSON.stringify({ dryRun: !apply, orderCount: orders.length, processed: report.length, output }, null, 2));
  await connection.close();
}

main().catch(async (error) => { console.error(error); await connection.close(); process.exit(1); });
