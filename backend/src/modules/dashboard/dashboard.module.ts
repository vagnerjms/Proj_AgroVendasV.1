import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FiscalDocument, FiscalDocumentSchema } from '../fiscal-documents/schemas/fiscal-document.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../purchase-orders/schemas/purchase-order.schema';
import { SalesOrder, SalesOrderSchema } from '../sales-orders/schemas/sales-order.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalesOrder.name, schema: SalesOrderSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: FiscalDocument.name, schema: FiscalDocumentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
