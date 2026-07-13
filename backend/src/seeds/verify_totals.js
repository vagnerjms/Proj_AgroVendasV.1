const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  await mongoose.connect(mongoUri);
  const SalesOrderCol = mongoose.connection.collection('salesorders');
  const FiscalDocCol = mongoose.connection.collection('fiscaldocuments');

  const orderNumbers = ['9654', '9660', '9668', '9674', '9679', '9681', '9686'];
  const orders = await SalesOrderCol.find({ orderNumber: { $in: orderNumbers } }).toArray();

  let totalParticular = 0;
  let totalReceivable = 0;
  let totalFunrural = 0;
  let totalBags = 0;

  console.log('--- INDIVIDUAL SALES ORDER CHECK ---');
  for (const o of orders) {
    const fdoc = await FiscalDocCol.findOne({ salesOrderId: o._id });
    console.log(`Order: ${o.orderNumber} | Date: ${o.date.toISOString().split('T')[0]}`);
    console.log(`  - Total Bags: ${o.totalBags}`);
    console.log(`  - Total Particular: R$ ${o.totalParticularAmount}`);
    console.log(`  - Total Receivable (Receber): R$ ${o.totalReceivableAmount}`);
    console.log(`  - FUNRURAL Retention: R$ ${o.funruralRetentionAmount}`);
    console.log(`  - Total Cost (Custo): R$ ${o.totalCostAmount}`);
    console.log(`  - Producer Net (A Pagar Produtor): R$ ${o.producerNetAmount}`);
    console.log(`  - Fiscal Doc Amount (NFe): R$ ${fdoc ? fdoc.amount : 'N/A'}`);
    
    totalParticular += o.totalParticularAmount;
    totalReceivable += o.totalReceivableAmount;
    totalFunrural += o.funruralRetentionAmount;
    totalBags += o.totalBags;
  }

  console.log('\n--- AGGREGATE TOTALS ---');
  console.log(`Total Bags: ${totalBags} (Expected: 4783)`);
  console.log(`Total Particular: R$ ${totalParticular.toFixed(2)} (Expected: 175737.00)`);
  console.log(`Total Receivable: R$ ${totalReceivable.toFixed(2)} (Expected: 173559.00)`);
  console.log(`Total FUNRURAL: R$ ${totalFunrural.toFixed(2)} (Expected: 2178.00)`);


  await mongoose.disconnect();
}

run().catch(console.error);
