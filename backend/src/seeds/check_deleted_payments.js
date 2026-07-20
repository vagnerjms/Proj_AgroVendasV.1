const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  await mongoose.connect(mongoUri);
  const PaymentCol = mongoose.connection.collection('payments');
  const SalesOrderCol = mongoose.connection.collection('salesorders');
  const PurchaseOrderCol = mongoose.connection.collection('purchaseorders');

  console.log('=== CHECKING ALL PAYMENTS IN DATABASE ===');
  const payments = await PaymentCol.find({}).toArray();
  console.log(`Total payment documents in DB: ${payments.length}`);

  for (const p of payments) {
    let salesOrder = null;
    let purchaseOrder = null;

    if (p.salesOrderId) {
      salesOrder = await SalesOrderCol.findOne({ _id: p.salesOrderId });
    }
    if (p.purchaseOrderId) {
      purchaseOrder = await PurchaseOrderCol.findOne({ _id: p.purchaseOrderId });
    }

    console.log(`Payment ID: ${p._id} | OrderNumber: ${p.orderNumber} | Type: ${p.type} | Amount: ${p.amount} | Status: ${p.status} | isDeleted: ${p.isDeleted}`);
    console.log(`  - SalesOrder in DB: ${salesOrder ? 'EXISTS (orderNumber: ' + salesOrder.orderNumber + ', isDeleted: ' + salesOrder.isDeleted + ')' : (p.salesOrderId ? 'NOT FOUND / DELETED' : 'N/A')}`);
    console.log(`  - PurchaseOrder in DB: ${purchaseOrder ? 'EXISTS (orderNumber: ' + purchaseOrder.orderNumber + ', isDeleted: ' + purchaseOrder.isDeleted + ')' : (p.purchaseOrderId ? 'NOT FOUND / DELETED' : 'N/A')}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
