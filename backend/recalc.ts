import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SalesOrdersService } from './src/modules/sales-orders/sales-orders.service';
import { PurchaseOrdersService } from './src/modules/purchase-orders/purchase-orders.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalesOrder } from './src/modules/sales-orders/schemas/sales-order.schema';
import { PurchaseOrder } from './src/modules/purchase-orders/schemas/purchase-order.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesService = app.get(SalesOrdersService);
  const purchaseService = app.get(PurchaseOrdersService);
  
  const salesModel = app.get<Model<SalesOrder>>(getModelToken(SalesOrder.name));
  const purchaseModel = app.get<Model<PurchaseOrder>>(getModelToken(PurchaseOrder.name));

  console.log('Buscando vendas...');
  const sales = await salesModel.find({ isDeleted: false, status: { $ne: 'draft' } }).select('_id orderNumber').lean();
  for (const sale of sales) {
    console.log('Recalculando Venda ' + sale.orderNumber);
    await salesService.recalculateFinancials(sale._id.toString());
  }

  console.log('Buscando compras...');
  const purchases = await purchaseModel.find({ isDeleted: false, status: { $ne: 'draft' } }).select('_id orderNumber').lean();
  for (const purchase of purchases) {
    console.log('Recalculando Compra ' + purchase.orderNumber);
    await purchaseService.recalculateFinancials(purchase._id.toString());
  }

  console.log('Concluido!');
  await app.close();
  process.exit(0);
}

bootstrap();
