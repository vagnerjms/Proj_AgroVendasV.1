import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CountersModule } from '../counters/counters.module';
import { PaymentsModule } from '../payments/payments.module';
import { SalesOrder, SalesOrderSchema } from './schemas/sales-order.schema';
import { SalesOrderCalculationService } from './sales-order-calculation.service';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { PdfService } from './pdf.service';

import { FiscalDocument, FiscalDocumentSchema } from '../fiscal-documents/schemas/fiscal-document.schema';

@Module({
  imports: [CountersModule, PaymentsModule, MongooseModule.forFeature([{ name: SalesOrder.name, schema: SalesOrderSchema }, { name: FiscalDocument.name, schema: FiscalDocumentSchema }])],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService, SalesOrderCalculationService, PdfService],
  exports: [SalesOrdersService, SalesOrderCalculationService, MongooseModule, PdfService],
})
export class SalesOrdersModule {}
