import mongoose from 'mongoose';

const mongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://localhost:27017/agrovenda_broker';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://179.197.231.106:5678/webhook/agrovendas-uploads';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://179.197.231.106:3001';

async function run() {
  console.log('Iniciando sincronização de arquivos históricos com o n8n...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  // 1. Sincronizar anexos de vendas
  const salesOrdersCol = db.collection('salesorders');
  const customersCol = db.collection('customers');
  
  const salesOrders = await salesOrdersCol.find({ 
    attachments: { $exists: true, $not: { $size: 0 } },
    isDeleted: { $ne: true }
  }).toArray();

  console.log(`Encontradas ${salesOrders.length} vendas com anexos.`);

  let salesCount = 0;
  for (const order of salesOrders) {
    const customer = order.customerId ? await customersCol.findOne({ _id: order.customerId }) : null;
    const partnerName = customer?.name || 'Cliente';

    for (const filename of order.attachments) {
      const payload = {
        orderNumber: order.orderNumber,
        partnerName,
        fileType: 'anexo_venda',
        originalName: filename.substring(filename.indexOf('-') + 1), // remove o prefixo timestamp do arquivo
        downloadUrl: `${API_URL}/sales-orders/${order._id}/files/${filename}`
      };

      console.log(`-> Enviando anexo de venda: ${payload.originalName} (${order.orderNumber})`);
      try {
        await (global as any).fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        salesCount++;
      } catch (err: any) {
        console.error(`Erro ao enviar para n8n: ${err.message}`);
      }
    }
  }

  // 2. Sincronizar arquivos fiscais (NFs)
  const fiscalDocsCol = db.collection('fiscaldocuments');
  const purchaseOrdersCol = db.collection('purchaseorders');
  const producersCol = db.collection('producers');
  const usersCol = db.collection('users');
  
  const fiscalDocs = await fiscalDocsCol.find({ 
    files: { $exists: true, $not: { $size: 0 } },
    isDeleted: { $ne: true }
  }).toArray();

  console.log(`Encontrados ${fiscalDocs.length} documentos fiscais com arquivos.`);

  let fiscalCount = 0;
  for (const doc of fiscalDocs) {
    let partnerName = 'Cliente';
    
    if (doc.salesOrderId) {
      const order = await salesOrdersCol.findOne({ _id: doc.salesOrderId });
      if (order) {
        const customer = order.customerId ? await customersCol.findOne({ _id: order.customerId }) : null;
        partnerName = customer?.name || 'Cliente';
      }
    } else if (doc.purchaseOrderId) {
      const order = await purchaseOrdersCol.findOne({ _id: doc.purchaseOrderId });
      if (order) {
        const producer = order.producerId 
          ? (await producersCol.findOne({ _id: order.producerId }) || await usersCol.findOne({ _id: order.producerId }))
          : null;
        partnerName = producer?.name || 'Produtor';
      }
    }

    for (const file of doc.files) {
      const fileId = file._id?.toString() || '';
      const payload = {
        orderNumber: doc.orderNumber,
        partnerName,
        fileType: 'nota_fiscal',
        originalName: file.originalName,
        downloadUrl: `${API_URL}/fiscal-documents/${doc._id}/files/${fileId}/download`
      };

      console.log(`-> Enviando nota fiscal: ${payload.originalName} (${doc.orderNumber})`);
      try {
        await (global as any).fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        fiscalCount++;
      } catch (err: any) {
        console.error(`Erro ao enviar para n8n: ${err.message}`);
      }
    }
  }

  console.log(`\nSincronização concluída com sucesso!`);
  console.log(`Total de anexos de venda enviados: ${salesCount}`);
  console.log(`Total de notas fiscais enviadas: ${fiscalCount}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Erro na execução do script:', error);
  await mongoose.disconnect();
  process.exit(1);
});
