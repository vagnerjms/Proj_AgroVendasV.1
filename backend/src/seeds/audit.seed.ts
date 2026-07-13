import mongoose from 'mongoose';
import { CustomerSchema } from '../modules/customers/schemas/customer.schema';
import { ProducerSchema } from '../modules/producers/schemas/producer.schema';

const mongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://localhost:27017/agrovenda_broker';

const rawRecords = [
  { orderNumber: 'VP9654', date: '2025-11-18', qtys: [543, 25, 42, 11, 1], prices: [40, 15, 15, 15, 20] },
  { orderNumber: 'VP9660', date: '2025-11-20', qtys: [651, 21, 62, 10, 1], prices: [35, 10, 10, 10, 10] },
  { orderNumber: 'VP9668', date: '2025-11-23', qtys: [571, 27, 69, 9, 1], prices: [52, 18, 18, 18, 18] },
  { orderNumber: 'VP9674', date: '2025-11-25', qtys: [608, 24, 86, 13, 2], prices: [40, 10, 10, 10, 10] },
  { orderNumber: 'VP9679', date: '2025-11-26', qtys: [572, 25, 59, 12, 2], prices: [38, 12, 12, 12, 20] },
  { orderNumber: 'VP9681', date: '2025-11-27', qtys: [577, 23, 45, 13, 1], prices: [40, 12, 12, 12, 12] },
  { orderNumber: 'VP9686', date: '2025-11-28', qtys: [601, 32, 49, 3, 3], prices: [40, 10, 10, 10, 20] }
];

const productIds = [
  '6a483403d90376674b57a6dd', // Batata Especial
  '6a483403d90376674b57a6e4', // Batata Primeira X
  '6a483403d90376674b57a6ea', // Batata Diversa
  '6a483403d90376674b57a6ee', // Batata Bolinha
  '6a483403d90376674b57a6f1'  // Batata Florão
];

function roundMoney(val: number): number {
  return Math.round(val * 100) / 100;
}

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const Producer = mongoose.model('Producer', ProducerSchema);
  const Customer = mongoose.model('Customer', CustomerSchema);

  // 1. Create or Find Producer MARCIO D D M
  let producer = await Producer.findOne({ name: 'MARCIO D D M' });
  if (!producer) {
    console.log('Creating producer MARCIO D D M...');
    producer = await Producer.create({
      name: 'MARCIO D D M',
      documentType: 'cpf',
      documentNumber: '12345678901',
      city: 'Machado',
      state: 'MG',
      active: true,
      isDeleted: false,
      funruralConfig: { enabled: true, rate: 0.0163 }
    });
  }

  // 2. Find Customer
  const customer = await Customer.findOne({ name: 'Cliente Modelo Ceasa' });
  if (!customer) {
    throw new Error('Customer "Cliente Modelo Ceasa" not found in DB!');
  }

  // 3. Clear existing orders with these numbers to avoid duplication
  const numbers = rawRecords.map(r => r.orderNumber);
  await mongoose.connection.db!.collection('salesorders').deleteMany({ orderNumber: { $in: numbers } });
  await mongoose.connection.db!.collection('payments').deleteMany({ orderNumber: { $in: [...numbers, ...numbers.map(n => n + '-P')] } });

  console.log('Inserting orders and payments...');

  for (const record of rawRecords) {
    const items: any[] = [];
    let totalBags = 0;
    let totalParticularAmount = 0;
    let totalCostAmount = 0;

    for (let i = 0; i < 5; i++) {
      const qty = record.qtys[i];
      if (qty > 0) {
        const price = record.prices[i];
        const cost = price - 10; // 10 reais de lucro por saca
        totalBags += qty;
        totalParticularAmount += qty * price;
        totalCostAmount += qty * cost;

        items.push({
          productId: new mongoose.Types.ObjectId(productIds[i]),
          quantityBags: qty,
          bagWeightKg: 25,
          quantityKg: qty * 25,
          pricePerBag: price,
          lineTotal: roundMoney(qty * price),
          costPerBag: cost,
          lineCostTotal: roundMoney(qty * cost)
        });
      }
    }

    const totalKg = totalBags * 25;
    const funruralRate = 0.0163;
    const funruralSocialSecurityRate = 0.0132;
    const funruralRatRate = 0.0011;
    const funruralSenarRate = 0.0020;

    const funruralRetentionAmount = roundMoney(totalCostAmount * funruralRate);
    const funruralSocialSecurityAmount = roundMoney(totalCostAmount * funruralSocialSecurityRate);
    const funruralRatAmount = roundMoney(totalCostAmount * funruralRatRate);
    const funruralSenarAmount = roundMoney(totalCostAmount * funruralSenarRate);

    const totalReceivableAmount = roundMoney(totalParticularAmount);
    const producerNetAmount = roundMoney(totalCostAmount - funruralRetentionAmount);
    const marginAmount = roundMoney(totalParticularAmount - totalCostAmount);

    const salesOrderId = new mongoose.Types.ObjectId();

    // Insert sales order
    await mongoose.connection.db!.collection('salesorders').insertOne({
      _id: salesOrderId,
      orderNumber: record.orderNumber,
      saleType: 'compra_venda',
      status: 'confirmed',
      fiscalStatus: 'pending',
      customerId: customer._id,
      producerId: producer._id,
      date: new Date(record.date + 'T12:00:00.000Z'),
      dueDate: new Date(record.date + 'T12:00:00.000Z'),
      producerDueDate: new Date(record.date + 'T12:00:00.000Z'),
      destinationCity: 'Machado',
      destinationState: 'MG',
      paymentType: 'cash',
      termDays: 0,
      paymentOption: 'total',
      items,
      totalBags,
      totalKg,
      totalParticularAmount,
      totalCostAmount,
      funruralRate,
      funruralSocialSecurityRate,
      funruralRatRate,
      funruralSenarRate,
      funruralRetentionAmount,
      funruralSocialSecurityAmount,
      funruralRatAmount,
      funruralSenarAmount,
      totalReceivableAmount,
      producerNetAmount,
      marginAmount,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Insert Receivable
    await mongoose.connection.db!.collection('payments').insertOne({
      _id: new mongoose.Types.ObjectId(),
      type: 'receivable',
      salesOrderId,
      orderNumber: record.orderNumber,
      customerId: customer._id,
      customerName: customer.name,
      amount: totalReceivableAmount,
      paidAmount: 0,
      balanceAmount: totalReceivableAmount,
      dueDate: new Date(record.date + 'T12:00:00.000Z'),
      status: 'open',
      isDeleted: false,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Insert Payable
    await mongoose.connection.db!.collection('payments').insertOne({
      _id: new mongoose.Types.ObjectId(),
      type: 'payable',
      salesOrderId,
      orderNumber: record.orderNumber + '-P',
      producerId: producer._id,
      producerName: producer.name,
      amount: producerNetAmount,
      paidAmount: 0,
      balanceAmount: producerNetAmount,
      dueDate: new Date(record.date + 'T12:00:00.000Z'),
      status: 'open',
      isDeleted: false,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  console.log('All records inserted successfully.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
