import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CountersModule } from '../counters/counters.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder, PurchaseOrderSchema } from './schemas/purchase-order.schema';

import { FiscalDocument, FiscalDocumentSchema } from '../fiscal-documents/schemas/fiscal-document.schema';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: FiscalDocument.name, schema: FiscalDocumentSchema }
    ]),
    CountersModule,
    PaymentsModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
