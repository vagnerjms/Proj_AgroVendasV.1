const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('agrovenda_broker');
  
  const sales = await db.collection('salesorders').find({ isDeleted: false }).toArray();
  
  // Simulate populated structures
  const populated = [];
  for (const s of sales) {
    const customer = s.customerId ? await db.collection('customers').findOne({ _id: s.customerId }) : null;
    const producer = s.producerId ? await db.collection('producers').findOne({ _id: s.producerId }) : null;
    
    // Simulate what Mongoose lean + populate returns after JSON serialization
    populated.push({
      ...s,
      customerId: customer ? { _id: customer._id.toString(), name: customer.name } : null,
      producerId: producer ? { _id: producer._id.toString(), name: producer.name } : null,
    });
  }
  
  console.log('--- Test filter logic with customerId = "6a483403d90376674b57a714" ---');
  const targetCustomerId = '6a483403d90376674b57a714';
  const filteredCustomer = populated.filter(s => s.customerId?._id === targetCustomerId);
  console.log(`Matched customer: ${filteredCustomer.length} sales`);
  
  console.log('--- Test filter logic with producerId = "6a4bc134ffd8d83f17801ae9" ---');
  const targetProducerId = '6a4bc134ffd8d83f17801ae9';
  const filteredProducer = populated.filter(s => s.producerId?._id === targetProducerId);
  console.log(`Matched producer: ${filteredProducer.length} sales`);

  await client.close();
}

run().catch(console.error);
