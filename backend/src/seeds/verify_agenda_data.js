const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  await mongoose.connect(mongoUri);
  const SalesOrderCol = mongoose.connection.collection('salesorders');
  const PaymentCol = mongoose.connection.collection('payments');

  console.log('=== ALL SALES ORDERS IN DATABASE ===');
  const salesOrders = await SalesOrderCol.find({ isDeleted: false }).toArray();
  console.log(`Total Sales Orders: ${salesOrders.length}\n`);

  for (const s of salesOrders) {
    const payments = await PaymentCol.find({ salesOrderId: s._id, isDeleted: false }).toArray();
    console.log(`Order Number: ${s.orderNumber} | SaleType: ${s.saleType} | Status: ${s.status}`);
    console.log(`  - Producer Net Amount: R$ ${s.producerNetAmount}`);
    console.log(`  - Total Particular Amount: R$ ${s.totalParticularAmount}`);
    console.log(`  - Total Receivable Amount: R$ ${s.totalReceivableAmount}`);
    console.log(`  - Linked Payments Count: ${payments.length}`);
    for (const p of payments) {
      console.log(`      * Payment ID: ${p._id} | Type: ${p.type} | Amount: R$ ${p.amount} | DueDate: ${p.dueDate?.toISOString?.()?.slice(0, 10)} | Status: ${p.status}`);
    }
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
