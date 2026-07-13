const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('agrovenda_broker');
  
  const sales = await db.collection('salesorders').find({
    isDeleted: false,
    status: 'confirmed'
  }).toArray();
  
  console.log(`--- Total Confirmed Sales: ${sales.length} ---`);
  for (const s of sales) {
    const customer = s.customerId ? await db.collection('customers').findOne({ _id: s.customerId }) : null;
    const producer = s.producerId ? await db.collection('producers').findOne({ _id: s.producerId }) : null;
    console.log(`Order: ${s.orderNumber} | Date: ${s.date ? s.date.toISOString() : 'null'}`);
    console.log(`- saleType: ${s.saleType}`);
    console.log(`- customer: ${customer ? customer.name : 'null'} (_id: ${customer ? customer._id.toString() : 'null'})`);
    console.log(`- producer: ${producer ? producer.name : 'null'} (_id: ${producer ? producer._id.toString() : 'null'})`);
  }
  
  await client.close();
}

run().catch(console.error);
