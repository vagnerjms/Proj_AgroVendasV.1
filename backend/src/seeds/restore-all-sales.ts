import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SalesOrder, SalesOrderDocument } from '../modules/sales-orders/schemas/sales-order.schema';
import { FiscalDocument } from '../modules/fiscal-documents/schemas/fiscal-document.schema';
import { SalesOrdersService } from '../modules/sales-orders/sales-orders.service';
import { Customer } from '../modules/customers/schemas/customer.schema';
import { Producer } from '../modules/producers/schemas/producer.schema';
import { Product } from '../modules/products/schemas/product.schema';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Mapeamento completo e preciso do número da nota fiscal para o número do pedido de venda original (da planilha)
const invoiceToOrderMap: Record<string, string> = {
  '27957662': 'VP09711',
  '27957664': 'VP09712',
  '27957569': 'VP09713',
  '27967571': 'VP09714',
  '27970562': 'VP09715',
  '27977672': 'VP09716',
  '27980429': 'VP09717',
  '27980432': 'VP09718',
  '27998942': 'VP09720',
  '27999695': 'VP09721',
  '27999696': 'VP09722',
  '28003902': 'VP09723',
  '28008239': 'VP09724',
  '28007928': 'VP09725',
  '28017525': 'VP09726',
  '28017539': 'VP09727',
  '28021552': 'VP09729',
  '28024828': 'VP09730',
  '28033001': 'VP09731',
  '28042907': 'VP09732',
  '28042638': 'VP09733',
  '28042894': 'VP09728',
  '28047798': 'VP09735',
  '28053397': 'VP09736',
  '28053399': 'VP09738',
  '28058820': 'VP09737',
  '28069150': 'VP09742',
  '28069166': 'VP09743',
  '28059766': 'VP09739',
  '28067709': 'VP09740',
  '28042900': 'VP09730'
};

const weightMap: Record<string, number> = {
  '27957664': 19240,
  '27967571': 18200,
  '27970562': 22560,
  '27977672': 20300,
  '27980429': 19960,
  '27980432': 15810,
  '27998942': 19890,
  '27999695': 15998,
  '27999696': 11252,
  '28003902': 20240,
  '28007928': 16530,
  '28008239': 28120,
  '28017525': 18240,
  '28017539': 16720,
  '28021552': 15900,
  '28024828': 16750,
  '28033001': 19200,
  '28042638': 22388,
  '28042894': 18610,
  '28042900': 15135,
  '28042907': 10644,
  '28047798': 19580,
  '28053397': 18870,
  '28053399': 20540,
  '28058820': 19740,
  '28059766': 22220,
  '28067709': 15120,
  '28069150': 18680,
  '28069166': 21100,
  '27957569': 19285,
  '27957662': 21530
};

async function run() {
  console.log('Iniciando restauração completa do banco de dados baseada nas NFs e no Backup...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesOrdersService = app.get(SalesOrdersService);
  const salesOrderModel = app.get<Model<SalesOrderDocument>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));
  const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
  const producerModel = app.get<Model<Producer>>(getModelToken(Producer.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  // 1. Apagar APENAS as vendas duplicadas com identificador curto (VP001 a VP029)
  const backupPath = join(process.cwd(), 'vendas_backup.json');
  if (!existsSync(backupPath)) {
    console.error('Arquivo vendas_backup.json não encontrado na raiz do projeto!');
    await app.close();
    process.exit(1);
  }

  const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));
  const duplicateIds = backupData.map((sale: any) => sale.id); // Ex: ['VP001', 'VP002', ...]

  console.log('Limpando vendas duplicadas VP001 a VP029...');
  const deleteResult = await salesOrderModel.deleteMany({
    orderNumber: { $in: duplicateIds }
  });
  console.log(`Foram removidas ${deleteResult.deletedCount} vendas duplicadas do banco.`);

  // 2. Atualizar pesos líquidos das Notas Fiscais no banco de dados com base na planilha
  console.log('Atualizando pesos das Notas Fiscais com base na planilha...');
  let updatedWeightsCount = 0;
  for (const [nfeNum, weight] of Object.entries(weightMap)) {
    const result = await fiscalDocModel.updateOne(
      { number: nfeNum, isDeleted: false },
      { $set: { totalWeightKg: weight } }
    );
    if (result.matchedCount > 0) {
      updatedWeightsCount++;
    }
  }
  console.log(`Pesos atualizados para ${updatedWeightsCount} Notas Fiscais.`);

  // Buscar produtor padrão
  let producer = await producerModel.findOne({ isDeleted: false });
  if (!producer) {
    producer = await producerModel.create({ name: 'Produtor Padrão' });
  }

  // Buscar produto padrão
  let product = await productModel.findOne({ isDeleted: false });
  if (!product) {
    product = await productModel.create({ name: 'CENOURA', basePrice: 40 });
  }

  // 3. Restaurar / Reassociar as Notas Fiscais às vendas originais corretas (VP09711, etc.)
  const allFiscalDocs = await fiscalDocModel.find({ isDeleted: false }).exec();
  console.log(`Processando ${allFiscalDocs.length} notas fiscais para restauração...`);

  let restoredCount = 0;
  for (const doc of allFiscalDocs) {
    // Determinar o número do pedido original correto para esta NF
    const originalOrderNumber = invoiceToOrderMap[doc.number || ''] || doc.orderNumber;
    
    if (!originalOrderNumber || originalOrderNumber.startsWith('VP00') || originalOrderNumber.match(/^VP0[1-2]\d/)) {
      console.log(`Pulando nota ${doc.number} pois não possui mapeamento de venda original.`);
      continue;
    }

    // Buscar ou criar a venda original
    let salesOrder = await salesOrderModel.findOne({ orderNumber: originalOrderNumber, isDeleted: false });
    
    const qtyKg = doc.totalWeightKg || 0;
    const qtyBags = Math.round((qtyKg / 29) * 1000) / 1000;
    const docAmount = doc.amount || 0;
    const unitPrice = qtyBags > 0 ? Math.round((docAmount / qtyBags) * 10000) / 10000 : 0;

    if (!salesOrder) {
      console.log(`Reconstruindo venda original ${originalOrderNumber} para a Nota ${doc.number}...`);
      
      const clientName = doc.recipient || 'Cliente Padrão';
      let searchName = clientName.split(' ')[0];
      let customer = await customerModel.findOne({ name: { $regex: searchName, $options: 'i' }, isDeleted: false });
      if (!customer) {
        customer = await customerModel.create({
          name: clientName,
          documentType: 'cnpj',
          documentNumber: '00000000000000',
          city: 'Desconhecida',
          state: 'GO'
        });
      }

      salesOrder = await salesOrderModel.create({
        orderNumber: originalOrderNumber,
        saleType: 'particular',
        status: 'confirmed',
        date: doc.issuedAt || new Date(),
        customerId: customer._id,
        producerId: producer._id,
        items: [
          {
            productId: product._id,
            quantityBags: qtyBags,
            bagWeightKg: 29,
            quantityKg: qtyKg,
            pricePerBag: unitPrice,
            lineTotal: docAmount,
          }
        ],
        dueDate: doc.issuedAt || new Date(),
        dueDateManual: true
      });
      restoredCount++;
    } else {
      // Se a venda existe, atualizamos os seus itens para bater com os pesos e valores da nota fiscal
      salesOrder.items = [
        {
          productId: product._id,
          quantityBags: qtyBags,
          bagWeightKg: 29,
          quantityKg: qtyKg,
          pricePerBag: unitPrice,
          lineTotal: docAmount,
        }
      ];
      await salesOrder.save();
    }

    // Vincular e re-sincronizar a Nota Fiscal
    await fiscalDocModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          salesOrderId: salesOrder._id,
          orderNumber: originalOrderNumber,
          status: 'issued',
          adjustOrderAmount: true
        }
      }
    );

    // Recalcular financeiro
    await salesOrdersService.recalculateFinancials(salesOrder._id.toString());
  }

  console.log(`Processo finalizado com sucesso! ${restoredCount} vendas reconstruídas.`);
  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
