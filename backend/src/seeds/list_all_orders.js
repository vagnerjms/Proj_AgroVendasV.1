const { MongoClient } = require('mongodb');

async function listAllOrders() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agrovendas';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    
    console.log('--- COLEÇÕES ---');
    const cols = await db.listCollections().toArray();
    console.log(cols.map(c => c.name));

    console.log('--- VENDAS (salesorders) ---');
    const sales = await db.collection('salesorders').find({}).toArray();
    console.log(sales.map(s => ({
      _id: s._id,
      orderNumber: s.orderNumber,
      saleType: s.saleType,
      totalParticularAmount: s.totalParticularAmount,
      totalReceivableAmount: s.totalReceivableAmount,
      brokerageAmount: s.brokerageAmount,
      marginAmount: s.marginAmount,
      isDeleted: s.isDeleted
    })));

    console.log('--- COMPRAS (purchaseorders) ---');
    const purchases = await db.collection('purchaseorders').find({}).toArray();
    console.log(purchases.map(p => ({
      orderNumber: p.orderNumber,
      totalAmount: p.totalAmount
    })));

    console.log('--- PAGAMENTOS/TITULOS (payments) ---');
    const payments = await db.collection('payments').find({}).toArray();
    console.log(payments.map(p => ({
      orderNumber: p.orderNumber,
      type: p.type,
      amount: p.amount,
      balanceAmount: p.balanceAmount,
      status: p.status
    })));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

listAllOrders();
