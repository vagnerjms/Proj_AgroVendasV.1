import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SalesOrdersService } from '../modules/sales-orders/sales-orders.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalesOrder } from '../modules/sales-orders/schemas/sales-order.schema';
import { FiscalDocument } from '../modules/fiscal-documents/schemas/fiscal-document.schema';

async function run() {
  console.log('Iniciando sincronização de vendas com as notas fiscais...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesOrdersService = app.get(SalesOrdersService);
  const salesOrderModel = app.get<Model<SalesOrder>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));

  // Buscar todas as notas fiscais ativas vinculadas a vendas
  const fiscalDocs = await fiscalDocModel.find({ 
    isDeleted: false, 
    salesOrderId: { $exists: true, $ne: null },
    status: { $ne: 'cancelled' } 
  }).exec();

  console.log(`Encontradas ${fiscalDocs.length} notas fiscais para processar.`);

  let updatedCount = 0;

  for (const doc of fiscalDocs) {
    if (!doc.salesOrderId || !doc.amount || doc.amount <= 0) {
      continue;
    }

    const orderId = doc.salesOrderId.toString();
    const salesOrder = await salesOrderModel.findOne({ _id: orderId, isDeleted: false }).exec();

    if (!salesOrder) {
      console.log(`Nota NF ${doc.number}: Venda ${orderId} não encontrada ou excluída.`);
      continue;
    }

    const currentAmount = salesOrder.totalParticularAmount || 0;
    const targetAmount = doc.amount;

    // Se houver diferença de valor
    if (Math.abs(currentAmount - targetAmount) > 0.01) {
      console.log(`\nVenda ${salesOrder.orderNumber}:`);
      console.log(`  - Valor OP atual: R$ ${currentAmount}`);
      console.log(`  - Valor da Nota:  R$ ${targetAmount}`);

      if (salesOrder.items && salesOrder.items.length > 0) {
        const item = salesOrder.items[0];
        const pricePerBag = item.pricePerBag || 0;
        
        if (pricePerBag > 0) {
          const qtyBags = Math.round((targetAmount / pricePerBag) * 1000) / 1000;
          const qtyKg = Math.round(qtyBags * (item.bagWeightKg || 25) * 1000) / 1000;
          
          console.log(`  - Ajustando item: Sacos R$ ${item.quantityBags} -> ${qtyBags} | Peso R$ ${item.quantityKg} -> ${qtyKg}`);
          
          item.quantityBags = qtyBags;
          item.quantityKg = qtyKg;
          item.lineTotal = Math.round(qtyBags * pricePerBag * 100) / 100;

          await salesOrderModel.findByIdAndUpdate(orderId, { items: salesOrder.items });
          
          // Chamar o recálculo do service para atualizar impostos, netAmount, pagamentos, etc.
          await salesOrdersService.recalculateFinancials(orderId);
          
          // Atualizar o status da nota fiscal para emitida (pois agora os valores batem!)
          await fiscalDocModel.findByIdAndUpdate(doc._id, { status: 'issued' });
          
          console.log(`  - Venda ${salesOrder.orderNumber} recalculada e sincronizada com sucesso!`);
          updatedCount++;
        } else {
          console.log(`  - Erro: Venda sem preço unitário válido para recalcular.`);
        }
      }
    }
  }

  console.log(`\nSincronização concluída! ${updatedCount} vendas foram atualizadas.`);
  await app.close();
}

run().catch((err) => {
  console.error('Erro na execução do script:', err);
  process.exit(1);
});
