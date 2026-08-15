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

const jsonData = {
  "sales": [
    {
      "id": "VP001",
      "date": "2026-07-18",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 21530.0,
      "bags": 742.41,
      "price_per_bag": 45.0,
      "total_value": 33408.62,
      "due_date": "2026-08-27",
      "invoice_number": "27957662"
    },
    {
      "id": "VP002",
      "date": "2026-07-18",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 19240.0,
      "bags": 663.45,
      "price_per_bag": 45.0,
      "total_value": 29855.17,
      "due_date": "2026-08-27",
      "invoice_number": "27957664"
    },
    {
      "id": "VP003",
      "date": "2026-07-18",
      "customer": "Comercial de Verduras WD LTDA",
      "weight_kg": 19285.0,
      "bags": 665.0,
      "price_per_bag": 45.0,
      "total_value": 29875.0,
      "due_date": "2026-08-27",
      "invoice_number": "27957569"
    },
    {
      "id": "VP004",
      "date": "2026-07-21",
      "customer": "Marcelo Katsumi Harada (Tayo)",
      "weight_kg": 18200.0,
      "bags": 627.59,
      "price_per_bag": 45.0,
      "total_value": 28241.38,
      "due_date": "2026-08-30",
      "invoice_number": "27967571"
    },
    {
      "id": "VP006",
      "date": "2026-07-27",
      "customer": "Badin Favilla Hortifruti LTDA",
      "weight_kg": 15810.0,
      "bags": 545.17,
      "price_per_bag": 40.0,
      "total_value": 21806.9,
      "due_date": "2026-09-05",
      "invoice_number": "27980432"
    },
    {
      "id": "VP007",
      "date": "2026-07-21",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 22560.0,
      "bags": 777.93,
      "price_per_bag": 42.0,
      "total_value": 32673.1,
      "due_date": "2026-08-30",
      "invoice_number": "27970562"
    },
    {
      "id": "VP008",
      "date": "2026-07-22",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 19960.0,
      "bags": 688.28,
      "price_per_bag": 40.0,
      "total_value": 27531.03,
      "due_date": "2026-08-31",
      "invoice_number": "27980429"
    },
    {
      "id": "VP009",
      "date": "2026-07-24",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 19890.0,
      "bags": 685.86,
      "price_per_bag": 45.0,
      "total_value": 30863.79,
      "due_date": "2026-09-02",
      "invoice_number": "27998942"
    },
    {
      "id": "VP010",
      "date": "2026-07-22",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 20300.0,
      "bags": 700.0,
      "price_per_bag": 40.0,
      "total_value": 28000.0,
      "due_date": "2026-08-31",
      "invoice_number": "27977672"
    },
    {
      "id": "VP011",
      "date": "2026-07-26",
      "customer": "Badin Favilla Hortifruti LTDA",
      "weight_kg": 15998.0,
      "bags": 551.66,
      "price_per_bag": 45.0,
      "total_value": 24824.48,
      "due_date": "2026-09-04",
      "invoice_number": "27999695"
    },
    {
      "id": "VP012",
      "date": "2026-07-24",
      "customer": "Comercial de Verduras WD LTDA",
      "weight_kg": 11252.0,
      "bags": 388.0,
      "price_per_bag": 45.0,
      "total_value": 17460.0,
      "due_date": "2026-09-02",
      "invoice_number": "27999696"
    },
    {
      "id": "VP013",
      "date": "2026-07-27",
      "customer": "Marcelo Katsumi Harada (Tayo)",
      "weight_kg": 28120.0,
      "bags": 969.66,
      "price_per_bag": 55.0,
      "total_value": 53331.03,
      "due_date": "2026-09-05",
      "invoice_number": "28008239"
    },
    {
      "id": "VP014",
      "date": "2026-07-27",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 20240.0,
      "bags": 697.93,
      "price_per_bag": 55.0,
      "total_value": 38386.15,
      "due_date": "2026-09-05",
      "invoice_number": "28003902"
    },
    {
      "id": "VP015",
      "date": "2026-07-27",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 16530.0,
      "bags": 570.0,
      "price_per_bag": 55.0,
      "total_value": 31350.0,
      "due_date": "2026-09-05",
      "invoice_number": "28007928"
    },
    {
      "id": "VP016",
      "date": "2026-07-28",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 16720.0,
      "bags": 576.0,
      "price_per_bag": 55.0,
      "total_value": 31680.0,
      "due_date": "2026-09-06",
      "invoice_number": "28017539"
    },
    {
      "id": "VP017",
      "date": "2026-07-28",
      "customer": "Comercial de Verduras Azevedo LTDA",
      "weight_kg": 18240.0,
      "bags": 629.0,
      "price_per_bag": 55.0,
      "total_value": 34595.0,
      "due_date": "2026-09-06",
      "invoice_number": "28017525"
    },
    {
      "id": "VP018",
      "date": "2026-07-29",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 15900.0,
      "bags": 548.0,
      "price_per_bag": 55.0,
      "total_value": 30140.0,
      "due_date": "2026-09-07",
      "invoice_number": "28021552"
    },
    {
      "id": "VP019",
      "date": "2026-07-30",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 19200.0,
      "bags": 662.07,
      "price_per_bag": 62.0,
      "total_value": 41048.28,
      "due_date": "2026-09-08",
      "invoice_number": "28033001"
    },
    {
      "id": "VP020",
      "date": "2026-08-01",
      "customer": "Comercial de Verduras WD LTDA",
      "weight_kg": 10644.0,
      "bags": 367.0,
      "price_per_bag": 65.0,
      "total_value": 23855.0,
      "due_date": "2026-09-10",
      "invoice_number": "28042907"
    },
    {
      "id": "VP021",
      "date": "2026-08-01",
      "customer": "Badin Favilla Hortifruti LTDA",
      "weight_kg": 15135.0,
      "bags": 521.9,
      "price_per_bag": 65.0,
      "total_value": 33923.28,
      "due_date": "2026-09-10",
      "invoice_number": "28042900"
    },
    {
      "id": "VP022",
      "date": "2026-08-01",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 18610.0,
      "bags": 641.72,
      "price_per_bag": 60.0,
      "total_value": 38503.45,
      "due_date": "2026-09-10",
      "invoice_number": "28042894"
    },
    {
      "id": "VP023",
      "date": "2026-08-01",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 22388.0,
      "bags": 772.0,
      "price_per_bag": 65.0,
      "total_value": 50180.0,
      "due_date": "2026-09-10",
      "invoice_number": "28042638"
    },
    {
      "id": "VP024",
      "date": "2026-08-03",
      "customer": "Hortifruti Rubi LTDA",
      "weight_kg": 19580.0,
      "bags": 675.17,
      "price_per_bag": 65.0,
      "total_value": 43886.21,
      "due_date": "2026-09-12",
      "invoice_number": "28047798"
    },
    {
      "id": "VP025",
      "date": "2026-08-03",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 18870.0,
      "bags": 650.69,
      "price_per_bag": 65.0,
      "total_value": 42294.83,
      "due_date": "2026-09-12",
      "invoice_number": "28053397"
    },
    {
      "id": "VP026",
      "date": "2026-08-03",
      "customer": "Comercial de Verduras Azevedo LTDA",
      "weight_kg": 20540.0,
      "bags": 708.28,
      "price_per_bag": 65.0,
      "total_value": 46037.93,
      "due_date": "2026-09-12",
      "invoice_number": "28053399"
    },
    {
      "id": "VP027",
      "date": "2026-08-04",
      "customer": "Marcelo Katsumi Harada (Tayo)",
      "weight_kg": 19740.0,
      "bags": 680.69,
      "price_per_bag": 65.0,
      "total_value": 44244.83,
      "due_date": "2026-09-13",
      "invoice_number": "28058820"
    },
    {
      "id": "VP028",
      "date": "2026-08-05",
      "customer": "W & A Distribuidora de Verduras LTDA",
      "weight_kg": 18680.0,
      "bags": 644.14,
      "price_per_bag": 65.0,
      "total_value": 41868.97,
      "due_date": "2026-09-14",
      "invoice_number": "28069150"
    },
    {
      "id": "VP029",
      "date": "2026-08-05",
      "customer": "Hort Bom Alimentos LTD",
      "weight_kg": 21100.0,
      "bags": 727.59,
      "price_per_bag": 65.0,
      "total_value": 47293.1,
      "due_date": "2026-09-14",
      "invoice_number": "28069166"
    }
  ]
};

async function run() {
  console.log('Iniciando importação/sincronização de vendas via JSON completo...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const salesOrdersService = app.get(SalesOrdersService);
  const salesOrderModel = app.get<Model<SalesOrderDocument>>(getModelToken(SalesOrder.name));
  const fiscalDocModel = app.get<Model<FiscalDocument>>(getModelToken(FiscalDocument.name));
  const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
  const producerModel = app.get<Model<Producer>>(getModelToken(Producer.name));
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

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

  let successCount = 0;

  for (const sale of jsonData.sales) {
    let salesOrder = await salesOrderModel.findOne({ orderNumber: sale.id, isDeleted: false });
    
    if (!salesOrder) {
      console.log(`Venda ${sale.id} não encontrada no banco. Criando novo registro...`);
      
      // Buscar ou criar cliente
      let searchName = sale.customer.split(' ')[0]; // Ex: Hortifruti
      let customer = await customerModel.findOne({ name: { $regex: searchName, $options: 'i' }, isDeleted: false });
      if (!customer) {
        customer = await customerModel.create({ name: sale.customer, documentType: 'cnpj', documentNumber: '00000000000000', city: 'Desconhecida', state: 'GO' });
      }

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
      console.log(`Venda ${sale.id} encontrada. Atualizando itens...`);
      
      // Atualizar itens
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

    // Buscar ou criar documento fiscal
    let fiscalDoc = await fiscalDocModel.findOne({ number: sale.invoice_number, isDeleted: false });
    if (!fiscalDoc) {
      console.log(`Nota fiscal ${sale.invoice_number} não encontrada. Criando...`);
      fiscalDoc = await fiscalDocModel.create({
        salesOrderId: salesOrder._id,
        orderNumber: salesOrder.orderNumber,
        number: sale.invoice_number,
        amount: sale.total_value,
        totalWeightKg: sale.weight_kg,
        status: 'issued',
        adjustOrderAmount: true,
        issuedAt: new Date(sale.date),
        files: []
      });
    } else {
      console.log(`Nota fiscal ${sale.invoice_number} encontrada. Atualizando...`);
      await fiscalDocModel.updateOne(
        { _id: fiscalDoc._id },
        {
          $set: {
            salesOrderId: salesOrder._id,
            orderNumber: salesOrder.orderNumber,
            amount: sale.total_value,
            totalWeightKg: sale.weight_kg,
            status: 'issued',
            adjustOrderAmount: true,
            issuedAt: new Date(sale.date)
          }
        }
      );
    }

    console.log(`Sincronização para ${sale.id} com a Nota ${sale.invoice_number} concluída.`);
    successCount++;
  }

  console.log(`Sincronização de lançamentos do JSON concluída! ${successCount} vendas importadas/atualizadas.`);
  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
