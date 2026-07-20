const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  await mongoose.connect(mongoUri);
  const SalesOrderCol = mongoose.connection.collection('salesorders');
  const PurchaseOrderCol = mongoose.connection.collection('purchaseorders');
  const PaymentCol = mongoose.connection.collection('payments');

  console.log('=== CHECKING ORPHAN PAYMENTS ===');
  const payments = await PaymentCol.find({}).toArray();
  let deletedCount = 0;

  for (const p of payments) {
    let salesOrder = null;
    let purchaseOrder = null;

    if (p.salesOrderId) {
      salesOrder = await SalesOrderCol.findOne({ _id: p.salesOrderId, isDeleted: { $ne: true } });
    }
    if (p.purchaseOrderId) {
      purchaseOrder = await PurchaseOrderCol.findOne({ _id: p.purchaseOrderId, isDeleted: { $ne: true } });
    }

    if (p.salesOrderId && !salesOrder) {
      console.log(`Deleting orphan payment ${p._id} (Order ${p.orderNumber}) because SalesOrder ${p.salesOrderId} is missing/deleted.`);
      await PaymentCol.deleteOne({ _id: p._id });
      deletedCount++;
    } else if (p.purchaseOrderId && !purchaseOrder) {
      console.log(`Deleting orphan payment ${p._id} (Order ${p.orderNumber}) because PurchaseOrder ${p.purchaseOrderId} is missing/deleted.`);
      await PaymentCol.deleteOne({ _id: p._id });
      deletedCount++;
    }
  }

  console.log(`Cleaned ${deletedCount} orphan payments.`);
  await mongoose.disconnect();
}

run().catch(console.error);
