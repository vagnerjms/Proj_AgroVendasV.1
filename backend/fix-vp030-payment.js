const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('agrovenda_broker');
    
    console.log('🔍 Buscando a venda VP030...');
    const salesOrder = await db.collection('salesorders').findOne({ orderNumber: 'VP030', isDeleted: false });
    
    if (!salesOrder) {
      console.error('❌ Venda VP030 não encontrada ou está marcada como deletada.');
      return;
    }
    
    console.log(`✅ Venda encontrada! ID: ${salesOrder._id} | Vencimento da venda: ${salesOrder.dueDate || salesOrder.vencimento || 'N/A'}`);
    
    console.log('\n🔍 Buscando parcelas/pagamentos associados a esta venda...');
    const payments = await db.collection('payments').find({ 
      salesOrderId: salesOrder._id,
      isDeleted: false 
    }).toArray();
    
    if (payments.length === 0) {
      console.log('⚠️ Nenhuma parcela ativa encontrada para a venda VP030 no banco de dados.');
      return;
    }
    
    console.log(`📊 Encontrada(s) ${payments.length} parcela(s):`);
    payments.forEach(p => {
      console.log(`- ID: ${p._id} | Tipo: ${p.type} | Valor: R$ ${p.amount} | Vencimento Atual: ${p.dueDate ? p.dueDate.toISOString() : 'N/A'} | Status: ${p.status}`);
    });
    
    // O novo vencimento da venda é 14/09/2026 (conforme tela de detalhes da venda)
    // Definimos a data no formato ISO Date (UTC)
    const newDueDate = new Date('2026-09-14T03:00:00.000Z');
    
    console.log(`\n⚙️ Atualizando o vencimento de todas as parcelas ativas para: ${newDueDate.toISOString()}...`);
    const updateResult = await db.collection('payments').updateMany(
      { 
        salesOrderId: salesOrder._id,
        isDeleted: false 
      },
      { 
        $set: { 
          dueDate: newDueDate
        } 
      }
    );
    
    console.log(`\n🎉 Sucesso! Quantidade de parcelas atualizadas: ${updateResult.modifiedCount}`);
    
    // Verificando após atualização
    const updatedPayments = await db.collection('payments').find({ 
      salesOrderId: salesOrder._id,
      isDeleted: false 
    }).toArray();
    
    console.log('\n📋 Estado atualizado das parcelas:');
    updatedPayments.forEach(p => {
      console.log(`- ID: ${p._id} | Tipo: ${p.type} | Valor: R$ ${p.amount} | Novo Vencimento: ${p.dueDate.toISOString()} | Status: ${p.status}`);
    });
    
  } catch (error) {
    console.error('❌ Ocorreu um erro ao atualizar o banco de dados:', error);
  } finally {
    await client.close();
  }
}

run();
