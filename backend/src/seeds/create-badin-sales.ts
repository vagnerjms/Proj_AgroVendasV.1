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

const badinSales = [
  {
    orderNumber: 'VP09718',
    date: '2026-07-22',
    invoiceNumber: '27980432',
    invoiceDate: '2026-07-22',
    weight: 15810,
    bags: 545.17,
    pricePerBag: 40.00,
    totalValue: 21806.90,
    dueDate: '2026-08-31'
  },
  {
    orderNumber: 'VP09721',
    date: '2026-07-24',
    invoiceNumber: '27999695',
    invoiceDate: '2026-07-25',
    weight: 15998,
    bags: 551.66,
    pricePerBag: 45.00,
    totalValue: 24824.48,
    dueDate: '2026-09-04'
  },
  {
    orderNumber: 'VP09728',
    date: '2026-07-29',
    invoiceNumber: '28024828',
    invoiceDate: '2026-07-29',
    weight: 16750,
    bags: 577.59,
    pricePerBag: 55.00,
    totalValue: 31767.24,
    dueDate: '2026-09-07'
  },
  {
    orderNumber: 'VP09732',
    date: '2026-08-01',
    invoiceNumber: '28042900',
    invoiceDate: '2026-08-02',
    weight: 15135,
    bags: 521.90,
    pricePerBag: 65.00,
    totalValue: 33923.28,
    dueDate: '2026-09-11'
  }
];

async function run() {
  console.log('Iniciando lançamento das vendas Badin Favilla do zero (tipo corretagem)...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const salesOrdersService = app.get(SalesOrdersService);
  const salesOrderModel = app.get<Model<SalesOrderDocument>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));
  const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
  const producerModel = app.get<Model<Producer>>(getModelToken(Producer.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  // Tentar encontrar ou criar o produtor BRUNO PERES ROMEIRO
  let producer = await producerModel.findOne({ name: { $regex: /BRUNO PERES ROMEIRO/i }, isDeleted: false });
  if (!producer) {
    producer = await producerModel.create({
      name: 'BRUNO PERES ROMEIRO',
      documentType: 'cnpj',
      documentNumber: '00000000000001',
      city: 'Desconhecida',
      state: 'GO'
    });
  }

  // Tentar encontrar ou criar o cliente BADIN FAVILLA HORTIFRUTI LTDA
  let customer = await customerModel.findOne({ name: { $regex: /BADIN FAVILLA/i }, isDeleted: false });
  if (!customer) {
    customer = await customerModel.create({
      name: 'BADIN FAVILLA HORTIFRUTI LTDA',
      documentType: 'cnpj',
      documentNumber: '00000000000002',
      city: 'Desconhecida',
      state: 'GO'
    });
  }

  // Buscar produto padrão CENOURA
  let product = await productModel.findOne({ name: { $regex: /CENOURA/i }, isDeleted: false });
  if (!product) {
    product = await productModel.create({ name: 'CENOURA', basePrice: 40 });
  }

  for (const sale of badinSales) {
    console.log(`Lançando venda ${sale.orderNumber} (NF ${sale.invoiceNumber})...`);

    // 1. Deletar a venda antiga se existir
    await salesOrderModel.deleteMany({ orderNumber: sale.orderNumber });

    // 2. Criar a venda nova do zero como intermediação (corretagem)
    const salesOrder = await salesOrderModel.create({
      orderNumber: sale.orderNumber,
      saleType: 'intermediacao',
      status: 'confirmed',
      date: new Date(sale.date),
      customerId: customer._id,
      producerId: producer._id,
      items: [
        {
          productId: product._id,
          quantityBags: sale.bags,
          bagWeightKg: 29,
          quantityKg: sale.weight,
          pricePerBag: sale.pricePerBag,
          lineTotal: sale.totalValue,
        }
      ],
      dueDate: new Date(sale.dueDate),
      dueDateManual: true,
      brokerageFeeType: 'percentage',
      brokerageFeeValue: 3,
      brokeragePayer: 'producer'
    });

    // 3. Vincular ou criar a Nota Fiscal correspondente
    let fiscalDoc = await fiscalDocModel.findOne({ number: sale.invoiceNumber, isDeleted: false });
    if (!fiscalDoc) {
      fiscalDoc = await fiscalDocModel.create({
        salesOrderId: salesOrder._id,
        orderNumber: salesOrder.orderNumber,
        number: sale.invoiceNumber,
        amount: sale.totalValue,
        totalWeightKg: sale.weight,
        status: 'issued',
        adjustOrderAmount: true,
        issuedAt: new Date(sale.invoiceDate),
        files: []
      });
    } else {
      await fiscalDocModel.updateOne(
        { _id: fiscalDoc._id },
        {
          $set: {
            salesOrderId: salesOrder._id,
            orderNumber: salesOrder.orderNumber,
            amount: sale.totalValue,
            totalWeightKg: sale.weight,
            status: 'issued',
            adjustOrderAmount: true,
            issuedAt: new Date(sale.invoiceDate)
          }
        }
      );
    }

    // Recalcular financeiro
    await salesOrdersService.recalculateFinancials(salesOrder._id.toString());
  }

  console.log('Lançamento concluído com sucesso!');
  await app.close();
}

run().catch(console.error);
