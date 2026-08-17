import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalesOrder, SalesOrderDocument } from '../modules/sales-orders/schemas/sales-order.schema';
import { FiscalDocument } from '../modules/fiscal-documents/schemas/fiscal-document.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const salesOrderModel = app.get<Model<SalesOrderDocument>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));

  const docs = await fiscalDocModel.find({ isDeleted: false }).lean();
  const sales = await salesOrderModel.find({ isDeleted: false }).select('orderNumber').lean();

  console.log('--- DIAGNOSTIC DATA ---');
  console.log('TOTAL_FISCAL_DOCS:', docs.length);
  console.log('FISCAL_DOCS_LIST:', JSON.stringify(docs.map(d => ({ number: d.number, orderNumber: d.orderNumber }))));
  console.log('TOTAL_SALES:', sales.length);
  console.log('SALES_LIST:', JSON.stringify(sales.map(s => s.orderNumber)));
  console.log('-----------------------');

  await app.close();
}

run().catch(console.error);
