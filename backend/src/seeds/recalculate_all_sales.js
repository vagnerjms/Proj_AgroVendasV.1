const { MongoClient, ObjectId } = require('mongodb');

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function migrate() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agrovendas';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    
    console.log('Limpando registros excluídos e resequenciando vendas...');
    
    // 1. Deletar registros marcados como excluídos permanentemente
    const delSales = await db.collection('salesorders').deleteMany({ isDeleted: true });
    console.log(`Deletadas ${delSales.deletedCount} vendas deletadas do banco.`);
    const delPayments = await db.collection('payments').deleteMany({ isDeleted: true });
    console.log(`Deletados ${delPayments.deletedCount} pagamentos deletados do banco.`);
    const delFiscal = await db.collection('fiscaldocuments').deleteMany({ isDeleted: true });
    console.log(`Deletados ${delFiscal.deletedCount} documentos fiscais deletados do banco.`);

    // 2. Resequenciar vendas ativas
    const sales = await db.collection('salesorders')
      .find({ isDeleted: { $ne: true } })
      .sort({ date: 1, createdAt: 1 })
      .toArray();
      
    console.log(`Resequenciando ${sales.length} vendas ativas a partir de VP001...`);
    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const newOrderNumber = `VP${String(i + 1).padStart(3, '0')}`;
      console.log(`Atualizando venda ${sale.orderNumber} para ${newOrderNumber}`);
      await db.collection('salesorders').updateOne(
        { _id: sale._id },
        { $set: { orderNumber: newOrderNumber } }
      );
      sale.orderNumber = newOrderNumber;
    }

    console.log(`Encontradas ${sales.length} vendas ativas.`);

    for (const sale of sales) {
      console.log(`Recalculando Venda: ${sale.orderNumber} - Tipo: ${sale.saleType}`);

      // 1. Obter informações de Funrural
      const funruralRate = 0.0163;
      const funruralSocialSecurityRate = 0.013;
      const funruralRatRate = 0.001;
      const funruralSenarRate = 0.0023;

      let customerDocumentType = 'cnpj';
      if (sale.customerId) {
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(sale.customerId) });
        if (customer && customer.documentType) {
          customerDocumentType = customer.documentType;
        }
      }
      const isClientPJ = customerDocumentType === 'cnpj';

      // 2. Calcular totais de itens
      let totalBags = 0;
      let totalKg = 0;
      let totalParticularAmount = 0;
      let totalCostAmount = 0;

      const items = (sale.items || []).map((item) => {
        const qty = Number(item.quantityBags) || 0;
        const weight = Number(item.bagWeightKg) || 25;
        const price = Number(item.pricePerBag) || 0;
        const cost = Number(item.costPerBag) || 0;
        const itemQtyKg = item.quantityKg !== undefined && item.quantityKg !== null && item.quantityKg !== 0
          ? Number(item.quantityKg)
          : roundMoney(qty * weight);

        totalBags += qty;
        totalKg += itemQtyKg;
        totalParticularAmount += roundMoney(qty * price);
        totalCostAmount += roundMoney(qty * cost);

        return {
          ...item,
          quantityBags: qty,
          bagWeightKg: weight,
          quantityKg: itemQtyKg,
          pricePerBag: price,
          costPerBag: cost,
          totalPrice: roundMoney(qty * price),
          totalCost: roundMoney(qty * cost),
        };
      });

      const baseAmountValue = totalParticularAmount;
      const taxBaseAmount = (sale.nfeTotalAmount && sale.nfeTotalAmount > 0) ? sale.nfeTotalAmount : baseAmountValue;

      const funruralSocialSecurityAmount = roundMoney(taxBaseAmount * funruralSocialSecurityRate);
      const funruralRatAmount = roundMoney(taxBaseAmount * funruralRatRate);
      const funruralSenarAmount = roundMoney(taxBaseAmount * funruralSenarRate);
      const funruralRetentionAmount = roundMoney(taxBaseAmount * funruralRate);

      let brokerageAmount = 0;
      const brokerageFeeType = sale.brokerageFeeType;
      const brokerageFeeValue = Number(sale.brokerageFeeValue) || 0;
      
      if (brokerageFeeType === 'fixed') {
        brokerageAmount = roundMoney(totalBags * brokerageFeeValue);
      } else if (brokerageFeeType === 'percentage') {
        brokerageAmount = roundMoney(totalParticularAmount * (brokerageFeeValue / 100));
      }

      let totalReceivableAmount = 0;
      let producerNetAmount = 0;
      let marginAmount = 0;

      if (sale.saleType === 'compra_venda') {
        if (isClientPJ) {
          totalReceivableAmount = roundMoney(totalParticularAmount - funruralRetentionAmount);
        } else {
          totalReceivableAmount = totalParticularAmount;
        }
        producerNetAmount = totalCostAmount;
        marginAmount = roundMoney(totalReceivableAmount - totalCostAmount);
        brokerageAmount = 0;
      } else if (sale.saleType === 'venda_estoque') {
        if (isClientPJ) {
          totalReceivableAmount = roundMoney(totalParticularAmount - funruralRetentionAmount);
        } else {
          totalReceivableAmount = totalParticularAmount;
        }
        producerNetAmount = 0;
        marginAmount = roundMoney(totalReceivableAmount - totalCostAmount);
        brokerageAmount = 0;
      } else if (sale.saleType === 'intermediacao') {
        totalReceivableAmount = brokerageAmount;
        producerNetAmount = 0;
        marginAmount = 0;
      } else if (sale.saleType === 'particular') {
        if (isClientPJ) {
          totalReceivableAmount = roundMoney(totalParticularAmount - funruralRetentionAmount);
        } else {
          totalReceivableAmount = totalParticularAmount;
        }
        producerNetAmount = totalReceivableAmount;
        marginAmount = 0;
        brokerageAmount = 0;
      } else {
        if (isClientPJ) {
          totalReceivableAmount = roundMoney(totalParticularAmount - funruralRetentionAmount);
        } else {
          totalReceivableAmount = totalParticularAmount;
        }
        producerNetAmount = totalCostAmount;
        marginAmount = roundMoney(totalReceivableAmount - totalCostAmount);
      }

      // Atualizar venda
      const updatePayload = {
        items,
        totalBags,
        totalKg,
        totalParticularAmount,
        totalCostAmount,
        funruralRate,
        funruralSocialSecurityRate,
        funruralRatRate,
        funruralSenarRate,
        funruralSocialSecurityAmount,
        funruralRatAmount,
        funruralSenarAmount,
        funruralRetentionAmount,
        totalReceivableAmount,
        producerNetAmount,
        marginAmount,
        brokerageAmount,
      };

      await db.collection('salesorders').updateOne({ _id: sale._id }, { $set: updatePayload });

      // 3. Atualizar/Recriar Contas Financeiras (Payments)
      const salesOrderId = sale._id;
      
      // Contas a Receber (Receivable)
      if (sale.saleType === 'intermediacao') {
        await db.collection('payments').deleteMany({ salesOrderId, type: 'receivable', orderNumber: sale.orderNumber });
        
        const payer = sale.brokeragePayer || 'producer';
        const amountPayable = brokerageAmount;
        
        const createOrUpdateReceivable = async (entityId, entityName, entityWhatsapp, isCustomer, fraction, suffix) => {
          const val = roundMoney(amountPayable * fraction);
          if (val <= 0) return;

          const existing = await db.collection('payments').findOne({ salesOrderId, type: 'receivable', orderNumber: sale.orderNumber + suffix });
          if (existing) {
            const balanceAmount = roundMoney(val - (existing.paidAmount || 0));
            await db.collection('payments').updateOne({ _id: existing._id }, {
              $set: {
                amount: val,
                balanceAmount,
                status: balanceAmount <= 0 ? 'paid' : ((existing.paidAmount || 0) > 0 ? 'partial' : 'open')
              }
            });
          } else {
            await db.collection('payments').insertOne({
              type: 'receivable',
              salesOrderId,
              orderNumber: sale.orderNumber + suffix,
              customerId: isCustomer ? new ObjectId(entityId) : undefined,
              customerName: isCustomer ? entityName : undefined,
              customerWhatsapp: isCustomer ? entityWhatsapp : undefined,
              producerId: !isCustomer ? new ObjectId(entityId) : undefined,
              producerName: !isCustomer ? entityName : undefined,
              amount: val,
              paidAmount: 0,
              balanceAmount: val,
              dueDate: sale.dueDate ? new Date(sale.dueDate) : new Date(),
              status: 'open',
              isDeleted: false,
              history: [],
            });
          }
        };

        const customer = sale.customerId ? await db.collection('customers').findOne({ _id: new ObjectId(sale.customerId) }) : null;
        const producer = sale.producerId ? await db.collection('producers').findOne({ _id: new ObjectId(sale.producerId) }) : null;

        if (payer === 'producer' && producer) {
          await db.collection('payments').deleteMany({ salesOrderId, type: 'receivable', orderNumber: { $in: [sale.orderNumber + '-C', sale.orderNumber + '-P'] } });
          await createOrUpdateReceivable(producer._id, producer.name, producer.whatsapp, false, 1, '');
        } else if (payer === 'customer' && customer) {
          await db.collection('payments').deleteMany({ salesOrderId, type: 'receivable', orderNumber: { $in: [sale.orderNumber + '-P', sale.orderNumber + '-C'] } });
          await createOrUpdateReceivable(customer._id, customer.name, customer.whatsapp, true, 1, '');
        } else if (payer === 'both') {
          await db.collection('payments').deleteMany({ salesOrderId, type: 'receivable', orderNumber: sale.orderNumber });
          if (producer) await createOrUpdateReceivable(producer._id, producer.name, producer.whatsapp, false, 0.5, '-P');
          if (customer) await createOrUpdateReceivable(customer._id, customer.name, customer.whatsapp, true, 0.5, '-C');
        }
      } else {
        await db.collection('payments').deleteMany({ salesOrderId, type: 'receivable', orderNumber: { $in: [sale.orderNumber + '-P', sale.orderNumber + '-C'] } });
        
        const existing = await db.collection('payments').findOne({ salesOrderId, type: 'receivable', orderNumber: sale.orderNumber });
        const customer = sale.customerId ? await db.collection('customers').findOne({ _id: new ObjectId(sale.customerId) }) : null;
        const producer = sale.producerId ? await db.collection('producers').findOne({ _id: new ObjectId(sale.producerId) }) : null;

        if (existing) {
          const balanceAmount = roundMoney(totalReceivableAmount - (existing.paidAmount || 0));
          await db.collection('payments').updateOne({ _id: existing._id }, {
            $set: {
              amount: totalReceivableAmount,
              balanceAmount,
              status: balanceAmount <= 0 ? 'paid' : ((existing.paidAmount || 0) > 0 ? 'partial' : 'open')
            }
          });
        } else {
          await db.collection('payments').insertOne({
            type: 'receivable',
            salesOrderId,
            orderNumber: sale.orderNumber,
            customerId: customer ? customer._id : undefined,
            customerName: customer ? customer.name : undefined,
            customerWhatsapp: customer ? customer.whatsapp : undefined,
            producerId: producer ? producer._id : undefined,
            producerName: producer ? producer.name : undefined,
            amount: totalReceivableAmount,
            paidAmount: 0,
            balanceAmount: totalReceivableAmount,
            dueDate: sale.dueDate ? new Date(sale.dueDate) : new Date(),
            status: 'open',
            isDeleted: false,
            history: [],
          });
        }
      }

      // Contas a Pagar (Payable)
      if (sale.saleType === 'intermediacao' || sale.saleType === 'venda_estoque') {
        await db.collection('payments').deleteMany({ salesOrderId, type: 'payable' });
      } else {
        const existingPayable = await db.collection('payments').findOne({ salesOrderId, type: 'payable' });
        const customer = sale.customerId ? await db.collection('customers').findOne({ _id: new ObjectId(sale.customerId) }) : null;
        const producer = sale.producerId ? await db.collection('producers').findOne({ _id: new ObjectId(sale.producerId) }) : null;

        if (existingPayable) {
          const balanceAmount = roundMoney(producerNetAmount - (existingPayable.paidAmount || 0));
          await db.collection('payments').updateOne({ _id: existingPayable._id }, {
            $set: {
              amount: producerNetAmount,
              balanceAmount,
              status: balanceAmount <= 0 ? 'paid' : ((existingPayable.paidAmount || 0) > 0 ? 'partial' : 'open')
            }
          });
        } else if (producerNetAmount > 0) {
          await db.collection('payments').insertOne({
            type: 'payable',
            salesOrderId,
            orderNumber: sale.orderNumber,
            customerId: customer ? customer._id : undefined,
            customerName: customer ? customer.name : undefined,
            customerWhatsapp: customer ? customer.whatsapp : undefined,
            producerId: producer ? producer._id : undefined,
            producerName: producer ? producer.name : undefined,
            amount: producerNetAmount,
            paidAmount: 0,
            balanceAmount: producerNetAmount,
            dueDate: sale.producerDueDate ? new Date(sale.producerDueDate) : (sale.dueDate ? new Date(sale.dueDate) : new Date()),
            status: 'open',
            isDeleted: false,
            history: [],
          });
        }
      }
    }
    
    console.log('Recalculo concluído com sucesso!');
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.close();
  }
}

migrate();
