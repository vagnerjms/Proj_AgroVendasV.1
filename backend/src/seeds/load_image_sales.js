const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';
const apiUrl = 'http://localhost:3001';

const salesData = [
  {
    orderNumber: "9654",
    date: "2025-11-18T12:00:00.000Z",
    nfeAmount: 18000,
    items: [
      { name: "Batata Especial", qty: 543, price: 40.00 },
      { name: "Batata Primeira X", qty: 25, price: 15.00 },
      { name: "Batata Diversa", qty: 42, price: 15.00 },
      { name: "Batata Bolinha", qty: 11, price: 15.00 },
      { name: "Batata Florão", qty: 1, price: 20.00 }
    ]
  },
  {
    orderNumber: "9660",
    date: "2025-11-20T12:00:00.000Z",
    nfeAmount: 21000,
    items: [
      { name: "Batata Especial", qty: 651, price: 35.00 },
      { name: "Batata Primeira X", qty: 21, price: 10.00 },
      { name: "Batata Diversa", qty: 62, price: 10.00 },
      { name: "Batata Bolinha", qty: 10, price: 10.00 },
      { name: "Batata Florão", qty: 1, price: 10.00 }
    ]
  },
  {
    orderNumber: "9668",
    date: "2025-11-23T12:00:00.000Z",
    nfeAmount: 21000,
    items: [
      { name: "Batata Especial", qty: 571, price: 52.00 },
      { name: "Batata Primeira X", qty: 27, price: 18.00 },
      { name: "Batata Diversa", qty: 69, price: 18.00 },
      { name: "Batata Bolinha", qty: 9, price: 18.00 },
      { name: "Batata Florão", qty: 1, price: 18.00 }
    ]
  },
  {
    orderNumber: "9674",
    date: "2025-11-25T12:00:00.000Z",
    nfeAmount: 22200,
    items: [
      { name: "Batata Especial", qty: 608, price: 40.00 },
      { name: "Batata Primeira X", qty: 24, price: 10.00 },
      { name: "Batata Diversa", qty: 86, price: 10.00 },
      { name: "Batata Bolinha", qty: 13, price: 10.00 },
      { name: "Batata Florão", qty: 2, price: 10.00 }
    ]
  },
  {
    orderNumber: "9679",
    date: "2025-11-26T12:00:00.000Z",
    nfeAmount: 21000,
    items: [
      { name: "Batata Especial", qty: 572, price: 38.00 },
      { name: "Batata Primeira X", qty: 25, price: 12.00 },
      { name: "Batata Diversa", qty: 59, price: 12.00 },
      { name: "Batata Bolinha", qty: 12, price: 12.00 },
      { name: "Batata Florão", qty: 2, price: 20.00 }
    ]
  },
  {
    orderNumber: "9681",
    date: "2025-11-27T12:00:00.000Z",
    nfeAmount: 21000,
    items: [
      { name: "Batata Especial", qty: 577, price: 40.00 },
      { name: "Batata Primeira X", qty: 23, price: 12.00 },
      { name: "Batata Diversa", qty: 45, price: 12.00 },
      { name: "Batata Bolinha", qty: 13, price: 12.00 },
      { name: "Batata Florão", qty: 1, price: 12.00 }
    ]
  },
  {
    orderNumber: "9686",
    date: "2025-11-28T12:00:00.000Z",
    nfeAmount: 21000,
    items: [
      { name: "Batata Especial", qty: 601, price: 40.00 },
      { name: "Batata Primeira X", qty: 32, price: 10.00 },
      { name: "Batata Diversa", qty: 49, price: 10.00 },
      { name: "Batata Bolinha", qty: 3, price: 10.00 },
      { name: "Batata Florão", qty: 3, price: 20.00 }
    ]
  }
];

function calculateItemCosts(items, totalParticularAmount, nfeAmount) {
  const ratio = nfeAmount / totalParticularAmount;
  let runningCostSum = 0;
  
  // Calculate proportional costs for all items except the first one
  const computedItems = items.map((item, idx) => {
    if (idx === 0) return null; // process first item last for adjustment
    const costPerBag = Math.round(item.price * ratio * 100) / 100;
    const lineCost = Math.round(item.qty * costPerBag * 100) / 100;
    runningCostSum += lineCost;
    return {
      name: item.name,
      qty: item.qty,
      price: item.price,
      costPerBag: costPerBag
    };
  });

  // Calculate the first item cost to absorb any rounding differences
  const firstItem = items[0];
  const firstItemTargetLineCost = nfeAmount - runningCostSum;
  const firstItemCostPerBag = firstItemTargetLineCost / firstItem.qty;
  
  computedItems[0] = {
    name: firstItem.name,
    qty: firstItem.qty,
    price: firstItem.price,
    costPerBag: firstItemCostPerBag
  };

  return computedItems;
}

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);

  console.log('Authenticating with API...');
  const loginRes = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!' })
  });

  if (!loginRes.ok) {
    throw new Error(`Authentication failed with status ${loginRes.status}`);
  }

  const { accessToken } = await loginRes.json();
  console.log('Successfully authenticated!');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };

  // 1. Ensure Producer exists
  console.log('Checking producer MARCIO...');
  const producersRes = await fetch(`${apiUrl}/producers`, { headers });
  const producers = await producersRes.json();
  let producer = producers.find(p => p.name.toUpperCase() === 'MARCIO');
  
  if (!producer) {
    console.log('Creating producer MARCIO...');
    const createRes = await fetch(`${apiUrl}/producers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'MARCIO',
        documentType: 'cpf',
        documentNumber: '11122233344',
        city: 'Ponta Grossa',
        state: 'PR',
        active: true
      })
    });
    if (!createRes.ok) throw new Error(`Failed to create producer: ${await createRes.text()}`);
    producer = await createRes.json();
  }
  console.log(`Producer MARCIO ID: ${producer._id}`);

  // 2. Ensure Customer exists
  console.log('Checking customer D D M...');
  const customersRes = await fetch(`${apiUrl}/customers`, { headers });
  const customers = await customersRes.json();
  let customer = customers.find(c => c.name.toUpperCase() === 'D D M');

  if (!customer) {
    console.log('Creating customer D D M...');
    const createRes = await fetch(`${apiUrl}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'D D M',
        documentType: 'cnpj',
        documentNumber: '11222333000144',
        city: 'Belo Horizonte',
        state: 'MG',
        active: true
      })
    });
    if (!createRes.ok) throw new Error(`Failed to create customer: ${await createRes.text()}`);
    customer = await createRes.json();
  }
  console.log(`Customer D D M ID: ${customer._id}`);

  // 3. Ensure Product "Batata Florão" exists
  console.log('Checking product Batata Florão...');
  const productsRes = await fetch(`${apiUrl}/products`, { headers });
  let allProducts = await productsRes.json();
  let florãoProduct = allProducts.find(p => p.internalCode === 'BATATA_FLORAO');

  if (!florãoProduct) {
    console.log('Creating product Batata Florão...');
    const createRes = await fetch(`${apiUrl}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Batata Florão',
        category: 'Batata',
        variety: 'Batata Florão',
        defaultUnit: 'kg',
        internalCode: 'BATATA_FLORAO',
        active: true
      })
    });
    if (!createRes.ok) throw new Error(`Failed to create product: ${await createRes.text()}`);
    florãoProduct = await createRes.json();
    
    // Refresh products list
    const refreshRes = await fetch(`${apiUrl}/products`, { headers });
    allProducts = await refreshRes.json();
  }

  // Create lookup map of product name to ID
  const productMap = {};
  allProducts.forEach(p => {
    productMap[p.name] = p._id;
  });

  console.log('Product mapping loaded.');

  // Clean up existing records to ensure a fresh, duplicate-free state
  const SalesOrderCol = mongoose.connection.collection('salesorders');
  const FiscalDocCol = mongoose.connection.collection('fiscaldocuments');
  const PaymentCol = mongoose.connection.collection('payments');

  const orderNumbers = salesData.map(d => d.orderNumber);
  console.log('Cleaning up existing orders with numbers:', orderNumbers);
  
  const existingOrders = await SalesOrderCol.find({ orderNumber: { $in: orderNumbers } }).toArray();
  const existingOrderIds = existingOrders.map(o => o._id);
  
  if (existingOrderIds.length > 0) {
    await SalesOrderCol.deleteMany({ _id: { $in: existingOrderIds } });
    await FiscalDocCol.deleteMany({ salesOrderId: { $in: existingOrderIds } });
    await PaymentCol.deleteMany({ salesOrderId: { $in: existingOrderIds } });
    console.log('Clean up complete.');
  }

  // 4. Create each sale order
  for (const sale of salesData) {
    console.log(`Processing sale order Part. ${sale.orderNumber}...`);

    // Calculate totalParticularAmount first for the proportional item cost calculation
    let totalParticularAmount = 0;
    sale.items.forEach(item => {
      totalParticularAmount += item.qty * item.price;
    });

    const calculatedCosts = calculateItemCosts(sale.items, totalParticularAmount, sale.nfeAmount);

    const items = calculatedCosts.map(item => {
      const productId = productMap[item.name];
      if (!productId) throw new Error(`Product not found: ${item.name}`);
      return {
        productId,
        quantityBags: item.qty,
        pricePerBag: item.price,
        costPerBag: item.costPerBag, // cost is calculated proportionally to match nfeAmount exactly
        bagWeightKg: 25
      };
    });

    const createOrderPayload = {
      date: sale.date,
      producerId: producer._id,
      customerId: customer._id,
      destinationCity: 'Belo Horizonte',
      destinationState: 'MG',
      saleType: 'compra_venda',
      paymentType: 'cash',
      items,
      funruralRate: 0.015,
      notes: `Lançamento automático da venda part. ${sale.orderNumber}`
    };

    const orderRes = await fetch(`${apiUrl}/sales-orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createOrderPayload)
    });

    if (!orderRes.ok) {
      throw new Error(`Failed to create order Part. ${sale.orderNumber}: ${await orderRes.text()}`);
    }

    const createdOrder = await orderRes.json();
    const orderIdStr = createdOrder._id;

    // Find the existing fiscal document created by afterConfirm
    const existingFdoc = await FiscalDocCol.findOne({ salesOrderId: new mongoose.Types.ObjectId(orderIdStr) });
    if (!existingFdoc) throw new Error(`No automatic fiscal document found for sales order ${orderIdStr}`);

    // Direct database update: change the generated orderNumber to the original Part. order number
    console.log(`Updating database orderNumber to ${sale.orderNumber} for SalesOrder ID ${orderIdStr}...`);
    await SalesOrderCol.updateOne(
      { _id: new mongoose.Types.ObjectId(orderIdStr) },
      { $set: { orderNumber: sale.orderNumber } }
    );

    console.log(`Updating database orderNumber to ${sale.orderNumber} for FiscalDocument ID ${existingFdoc._id}...`);
    await FiscalDocCol.updateOne(
      { _id: existingFdoc._id },
      { $set: { orderNumber: sale.orderNumber } }
    );

    console.log(`Updating database orderNumber to ${sale.orderNumber} for Payments linked to SalesOrder ID ${orderIdStr}...`);
    await PaymentCol.updateMany(
      { salesOrderId: new mongoose.Types.ObjectId(orderIdStr) },
      { $set: { orderNumber: sale.orderNumber } }
    );

    // Call REST PATCH to update the fiscal document details (this recalculates financials automatically)
    console.log(`Updating fiscal document details for Part. ${sale.orderNumber} via REST API...`);
    const updateFiscalPayload = {
      number: sale.orderNumber,
      amount: sale.nfeAmount,
      status: 'issued',
      issuedAt: sale.date
    };

    const fiscalRes = await fetch(`${apiUrl}/fiscal-documents/${existingFdoc._id.toString()}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateFiscalPayload)
    });

    if (!fiscalRes.ok) {
      throw new Error(`Failed to update fiscal doc for Part. ${sale.orderNumber}: ${await fiscalRes.text()}`);
    }

    console.log(`Sale order ${sale.orderNumber} successfully processed and recalculated.`);
  }

  console.log('All sales processed successfully!');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
