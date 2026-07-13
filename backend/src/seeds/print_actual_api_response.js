const mongoose = require('mongoose');

const mongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://mongodb:27017/agrovenda_broker';

const SalesOrderSchema = new mongoose.Schema({}, { strict: false });

async function run() {
  await mongoose.connect(mongoUri);
  const SalesOrder = mongoose.model('SalesOrder', SalesOrderSchema, 'salesorders');
  
  const sales = await SalesOrder.find({ isDeleted: false, status: 'confirmed' })
    .populate('customerId', 'name')
    .populate('producerId', 'name')
    .lean();
    
  console.log('--- Actual Populate Output ---');
  for (const s of sales) {
    console.log(`Order: ${s.orderNumber}`);
    console.log('customerId:', JSON.stringify(s.customerId));
    console.log('producerId:', JSON.stringify(s.producerId));
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
