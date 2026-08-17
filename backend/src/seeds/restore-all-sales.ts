import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalesOrder, SalesOrderDocument } from '../modules/sales-orders/schemas/sales-order.schema';
import { FiscalDocument } from '../modules/fiscal-documents/schemas/fiscal-document.schema';
import { SalesOrdersService } from '../modules/sales-orders/sales-orders.service';
import { Customer } from '../modules/customers/schemas/customer.schema';
import { Producer } from '../modules/producers/schemas/producer.schema';
import { Product } from '../modules/products/schemas/product.schema';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function run() {
  console.log('Iniciando restauração de dados via Backup JSON...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesOrdersService = app.get(SalesOrdersService);
  const salesOrderModel = app.get<Model<SalesOrderDocument>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));
  const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
  const producerModel = app.get<Model<Producer>>(getModelToken(Producer.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  // 1. Apagar as antigas vendas com IDs curtos (VP001 a VP029) se ainda existirem
  const duplicateIds = Array.from({ length: 29 }, (_, i) => `VP${String(i + 1).padStart(3, '0')}`);
  await salesOrderModel.deleteMany({ orderNumber: { $in: duplicateIds } });

  // 2. Ler o arquivo de backup (que já está com os IDs e pesos reais)
  const backupPath = join(process.cwd(), 'vendas_backup.json');
  if (!existsSync(backupPath)) {
    console.error('Arquivo vendas_backup.json não encontrado!');
    await app.close();
    process.exit(1);
  }

  const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));

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

  let restoredCount = 0;

  for (const sale of backupData) {
    // Buscar se a venda original (ex: VP09711) já existe
    let salesOrder = await salesOrderModel.findOne({ orderNumber: sale.id, isDeleted: false });

    // Buscar ou criar cliente
    let searchName = sale.customer.split(' ')[0];
    let customer = await customerModel.findOne({ name: { $regex: searchName, $options: 'i' }, isDeleted: false });
    if (!customer) {
      customer = await customerModel.create({
        name: sale.customer,
        documentType: 'cnpj',
        documentNumber: '00000000000000',
        city: 'Desconhecida',
        state: 'GO'
      });
    }

    if (!salesOrder) {
      console.log(`Criando venda original ${sale.id} do Backup...`);
      salesOrder = await salesOrderModel.create({
        orderNumber: sale.id,
        saleType: 'particular',
        status: 'confirmed',
        date: new Date(sale.date),
        customerId: customer._id,
        producerId: producer._id,
        items: [
          {
            productId: product._id,
            quantityBags: sale.bags,
            bagWeightKg: 29,
            quantityKg: sale.weight_kg,
            pricePerBag: sale.price_per_bag,
            lineTotal: sale.total_value,
          }
        ],
        dueDate: new Date(sale.due_date),
        dueDateManual: true
      });
    } else {
      console.log(`Atualizando venda original ${sale.id} com os valores do Backup...`);
      salesOrder.items = [
        {
          productId: product._id,
          quantityBags: sale.bags,
          bagWeightKg: 29,
          quantityKg: sale.weight_kg,
          pricePerBag: sale.price_per_bag,
          lineTotal: sale.total_value,
        }
      ];
      salesOrder.date = new Date(sale.date);
      salesOrder.dueDate = new Date(sale.due_date);
      salesOrder.dueDateManual = true;
      await salesOrder.save();
    }

    // Vincular e atualizar Nota Fiscal
    let fiscalDoc = await fiscalDocModel.findOne({ number: sale.invoice_number, isDeleted: false });
    if (fiscalDoc) {
      await fiscalDocModel.updateOne(
        { _id: fiscalDoc._id },
        {
          $set: {
            salesOrderId: salesOrder._id,
            orderNumber: salesOrder.orderNumber,
            totalWeightKg: sale.weight_kg,
            amount: sale.total_value,
            status: 'issued',
            adjustOrderAmount: true
          }
        }
      );
    }

    // Recalcular financeiro
    await salesOrdersService.recalculateFinancials(salesOrder._id.toString());
    restoredCount++;
  }

  // 3. Garantir que qualquer outra nota fiscal tenha sua venda recalculada e associada
  const allFiscalDocs = await fiscalDocModel.find({ isDeleted: false }).exec();
  for (const doc of allFiscalDocs) {
    if (!doc.salesOrderId) continue;
    await salesOrdersService.recalculateFinancials(doc.salesOrderId.toString());
  }

  console.log(`Restauração de backup concluída! ${restoredCount} vendas processadas.`);
  await app.close();
}

run().catch(console.error);
