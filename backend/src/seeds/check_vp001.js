const { MongoClient } = require('mongodb');

async function checkVP001() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agrovendas';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    
    const salesOrder = await db.collection('salesorders').findOne({ orderNumber: 'VP001' });
    console.log('====================================');
    console.log('DETALHES DA VENDA VP001:');
    console.log(JSON.stringify(salesOrder, null, 2));
    console.log('====================================');
  } catch (err) {
    console.error('Erro ao conectar ao banco:', err);
  } finally {
    await client.close();
  }
}

checkVP001();
