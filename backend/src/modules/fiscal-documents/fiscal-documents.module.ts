import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseOrder, PurchaseOrderSchema } from '../purchase-orders/schemas/purchase-order.schema';
import { SalesOrder, SalesOrderSchema } from '../sales-orders/schemas/sales-order.schema';
import { FiscalDocumentsController } from './fiscal-documents.controller';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { FiscalDocument, FiscalDocumentSchema } from './schemas/fiscal-document.schema';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FiscalDocument.name, schema: FiscalDocumentSchema },
      { name: SalesOrder.name, schema: SalesOrderSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
    SalesOrdersModule,
    PurchaseOrdersModule,
  ],
  controllers: [FiscalDocumentsController],
  providers: [FiscalDocumentsService],
  exports: [FiscalDocumentsService, MongooseModule],
})
export class FiscalDocumentsModule {}
