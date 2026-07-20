const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  await mongoose.connect(mongoUri);
  const SalesOrderCol = mongoose.connection.collection('salesorders');
  const PaymentCol = mongoose.connection.collection('payments');

  console.log('=== CHECKING ALL SALES ORDERS (INCLUDING ISDELETED) ===');
  const allSales = await SalesOrderCol.find({}).toArray();
  console.log(`Total Sales Orders in Collection: ${allSales.length}`);
  allSales.forEach(s => {
    console.log(`- ID: ${s._id} | OrderNumber: ${s.orderNumber} | isDeleted: ${s.isDeleted} | Date: ${s.date ? s.date.toISOString().slice(0,10) : 'N/A'}`);
  });

  console.log('\n=== CHECKING ALL PAYMENTS (INCLUDING ISDELETED) ===');
  const allPayments = await PaymentCol.find({}).toArray();
  console.log(`Total Payments in Collection: ${allPayments.length}`);
  for (const p of allPayments) {
    let salesOrder = null;
    if (p.salesOrderId) {
      salesOrder = await SalesOrderCol.findOne({ _id: p.salesOrderId });
    }
    console.log(`- Payment ID: ${p._id} | Order: ${p.orderNumber} | Type: ${p.type} | Amount: ${p.amount} | isDeleted: ${p.isDeleted}`);
    console.log(`  Linked SalesOrder: ${salesOrder ? 'Found (isDeleted: ' + salesOrder.isDeleted + ')' : (p.salesOrderId ? 'NOT FOUND / DELETED' : 'None')}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
