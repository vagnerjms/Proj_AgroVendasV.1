import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SalesOrdersService } from '../modules/sales-orders/sales-orders.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalesOrder } from '../modules/sales-orders/schemas/sales-order.schema';
import { FiscalDocument } from '../modules/fiscal-documents/schemas/fiscal-document.schema';
import { FiscalDocumentsService } from '../modules/fiscal-documents/fiscal-documents.service';

async function run() {
  console.log('Iniciando sincronização de vendas com as notas fiscais...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesOrdersService = app.get(SalesOrdersService);
  const fiscalDocumentsService = app.get(FiscalDocumentsService);
  const salesOrderModel = app.get<Model<SalesOrder>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));

  // Rodar o backfill para garantir a extração do peso das notas antigas
  await fiscalDocumentsService.backfillExtractedData();

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
    const currentWeight = salesOrder.totalKg || 0;
    const targetWeight = doc.totalWeightKg || 0;

    const valueDivergent = Math.abs(currentAmount - targetAmount) > 0.01;
    const weightDivergent = targetWeight > 0 && Math.abs(currentWeight - targetWeight) > 0.01;

    if (valueDivergent || weightDivergent) {
      console.log(`\nVenda ${salesOrder.orderNumber}:`);
      console.log(`  - Valor OP atual: R$ ${currentAmount} | Valor da Nota: R$ ${targetAmount}`);
      console.log(`  - Peso OP atual:  ${currentWeight} kg | Peso da Nota:  ${targetWeight} kg`);

      if (salesOrder.items && salesOrder.items.length > 0) {
        const item = salesOrder.items[0];
        const bagWeight = item.bagWeightKg || 25;
        let qtyKg = doc.totalWeightKg || 0;
        if (qtyKg <= 0) {
          const pricePerBag = item.pricePerBag || 1;
          const qtyBags = Math.round((targetAmount / pricePerBag) * 1000) / 1000;
          qtyKg = Math.round(qtyBags * bagWeight * 1000) / 1000;
        }
        const qtyBags = Math.round((qtyKg / bagWeight) * 1000) / 1000;
        
        console.log(`  - Ajustando item: Sacos R$ ${item.quantityBags} -> ${qtyBags} | Peso R$ ${item.quantityKg} -> ${qtyKg}`);
        
        item.quantityBags = qtyBags;
        item.quantityKg = qtyKg;
        
        if (qtyBags > 0) {
          item.pricePerBag = Math.round((targetAmount / qtyBags) * 10000) / 10000;
          item.lineTotal = Math.round(qtyBags * item.pricePerBag * 100) / 100;
        }

        await salesOrderModel.findByIdAndUpdate(orderId, { items: salesOrder.items });
        
        // Chamar o recálculo do service para atualizar impostos, netAmount, pagamentos, etc.
        await salesOrdersService.recalculateFinancials(orderId);
        
        // Atualizar o status da nota fiscal para emitida (pois agora os valores batem!)
        await fiscalDocModel.findByIdAndUpdate(doc._id, { status: 'issued' });
        
        console.log(`  - Venda ${salesOrder.orderNumber} recalculada e sincronizada com sucesso!`);
        updatedCount++;
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
