const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/agrovenda_broker';
const apiUrl = 'http://localhost:3001';

async function run() {
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
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };

  console.log('Testing GET /payments?dueDateFrom=2025-11-01&dueDateTo=2025-11-30...');
  const paymentsRes = await fetch(`${apiUrl}/payments?dueDateFrom=2025-11-01&dueDateTo=2025-11-30`, { headers });
  const payments = await paymentsRes.json();

  console.log(`\nReturned Payments Count: ${payments.length}`);

  const payables = payments.filter(p => p.type === 'payable');
  const receivables = payments.filter(p => p.type === 'receivable');

  console.log(`- Contas a Pagar (payables): ${payables.length}`);
  console.log(`- Contas a Receber (receivables): ${receivables.length}\n`);

  console.log('--- DETAILED PAYABLE ITEMS RETURNED BY API ---');
  payables.forEach(p => {
    console.log(`[PAYABLE] Order: ${p.orderNumber} | Produtor: ${p.producerName || p.producerId?.name} | Valor: R$ ${p.amount} | Balance: R$ ${p.balanceAmount} | DueDate: ${p.dueDate?.slice(0, 10)}`);
  });

  console.log('\nTesting GET /payments/alerts...');
  const alertsRes = await fetch(`${apiUrl}/payments/alerts`, { headers });
  const alerts = await alertsRes.json();
  console.log(`- Overdue payables count: ${alerts.payablesOverdue?.length ?? 0}`);
  console.log(`- Overdue receivables count: ${alerts.receivablesOverdue?.length ?? 0}`);

}

run().catch(console.error);
