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

async function run() {
  console.log('Iniciando restauração completa do banco de dados...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesOrdersService = app.get(SalesOrdersService);
  const salesOrderModel = app.get<Model<SalesOrderDocument>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));
  const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
  const producerModel = app.get<Model<Producer>>(getModelToken(Producer.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  // 1. Ler o arquivo de backup
  const backupPath = join(process.cwd(), 'vendas_backup.json');
  if (!existsSync(backupPath)) {
    console.error('Arquivo vendas_backup.json não encontrado na raiz do projeto!');
    await app.close();
    process.exit(1);
  }

  const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));
  console.log(`Carregadas ${backupData.length} vendas do backup JSON.`);

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

  // Restaurar vendas do JSON
  for (const sale of backupData) {
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

    const orderId = salesOrder._id.toString();
    await salesOrdersService.recalculateFinancials(orderId);

    // Reassociar nota fiscal
    let fiscalDoc = await fiscalDocModel.findOne({ number: sale.invoice_number, isDeleted: false });
    if (fiscalDoc) {
      await fiscalDocModel.updateOne(
        { _id: fiscalDoc._id },
        {
          $set: {
            salesOrderId: salesOrder._id,
            orderNumber: salesOrder.orderNumber,
            amount: sale.total_value,
            totalWeightKg: sale.weight_kg,
            status: 'issued',
            adjustOrderAmount: true
          }
        }
      );
    }
    restoredCount++;
  }

  // 2. Reconstruir vendas baseadas nas Notas Fiscais cujo pedido original sumiu
  const allFiscalDocs = await fiscalDocModel.find({ isDeleted: false }).exec();
  console.log(`Varrendo ${allFiscalDocs.length} notas fiscais para recuperar vendas de lote (ex: VP09711)...`);

  for (const doc of allFiscalDocs) {
    if (!doc.orderNumber) continue;

    // Verificar se a venda correspondente existe no banco
    let salesOrder = await salesOrderModel.findOne({ orderNumber: doc.orderNumber, isDeleted: false });
    if (!salesOrder) {
      console.log(`Reconstruindo venda original ${doc.orderNumber} a partir da Nota ${doc.number}...`);

      // Tentar encontrar o cliente correspondente
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

      const qtyKg = doc.totalWeightKg || 0;
      const qtyBags = Math.round((qtyKg / 29) * 1000) / 1000;
      const docAmount = doc.amount || 0;
      const unitPrice = qtyBags > 0 ? Math.round((docAmount / qtyBags) * 10000) / 10000 : 0;

      salesOrder = await salesOrderModel.create({
        orderNumber: doc.orderNumber,
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

      const orderId = salesOrder._id.toString();
      await salesOrdersService.recalculateFinancials(orderId);

      // Reassociar nota fiscal
      await fiscalDocModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            salesOrderId: salesOrder._id,
            status: 'issued'
          }
        }
      );
      restoredCount++;
    } else {
      // Se a venda existe, garanta que está associada e recalculada
      await fiscalDocModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            salesOrderId: salesOrder._id,
            status: 'issued'
          }
        }
      );
      await salesOrdersService.recalculateFinancials(salesOrder._id.toString());
    }
  }

  console.log(`Restauração concluída! ${restoredCount} registros recuperados.`);
  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
