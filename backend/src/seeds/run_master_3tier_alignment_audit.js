const apiUrl = process.env.API_URL || 'http://localhost:3001';

async function runMasterAlignmentAudit() {
  console.log('========================================================================================');
  console.log('    AUDITORIA DE ALINHAMENTO TRÍPLICE (BANCO DE DADOS ➔ BACKEND NESTJS ➔ FRONTEND NEXT.JS)  ');
  console.log('========================================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function log(testName, success, details = '') {
    if (success) {
      passedTests++;
      console.log(`[PASSED] ✅ ${testName} ${details ? '- ' + details : ''}`);
    } else {
      failedTests++;
      console.error(`[FAILED] ❌ ${testName} ${details ? '- ' + details : ''}`);
    }
  }

  let token = '';

  // 1. Autenticação & Emissão de Token JWT
  try {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!', rememberMe: true })
    });
    const data = await res.json();
    token = data.accessToken;
    log('1. Autenticação & Sessão de 1 Ano (POST /auth/login)', !!token, token ? 'Token Emitido com Sucesso' : 'Falha');
  } catch (err) {
    log('1. Autenticação & Sessão de 1 Ano', false, err.message);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Alinhamento de Módulo de Usuários (MongoDB ➔ NestJS UsersService ➔ Frontend /usuarios)
  try {
    const res = await fetch(`${apiUrl}/users`, { headers });
    const users = await res.json();
    const hasAdmin = Array.isArray(users) && users.some(u => u.role === 'admin');
    log('2. Alinhamento de Usuários e Permissões (GET /users)', hasAdmin, `${users.length} usuários retornados do MongoDB`);
  } catch (err) {
    log('2. Alinhamento de Usuários e Permissões', false, err.message);
  }

  // 3. Alinhamento do Catálogo de Produtos (MongoDB ➔ NestJS Products ➔ Frontend /products & /new-sale)
  try {
    const res = await fetch(`${apiUrl}/products`, { headers });
    const products = await res.json();
    log('3. Alinhamento do Catálogo de Produtos (GET /products)', Array.isArray(products), `${products.length} tipos de café alinhados`);
  } catch (err) {
    log('3. Alinhamento do Catálogo de Produtos', false, err.message);
  }

  // 4. Alinhamento de Parceiros: Clientes (Compradores)
  try {
    const res = await fetch(`${apiUrl}/customers`, { headers });
    const customers = await res.json();
    log('4. Alinhamento de Clientes (GET /customers)', Array.isArray(customers), `${customers.length} clientes ativos`);
  } catch (err) {
    log('4. Alinhamento de Clientes', false, err.message);
  }

  // 5. Alinhamento de Parceiros: Produtores (Vendedores)
  try {
    const res = await fetch(`${apiUrl}/producers`, { headers });
    const producers = await res.json();
    log('5. Alinhamento de Produtores (GET /producers)', Array.isArray(producers), `${producers.length} produtores ativos`);
  } catch (err) {
    log('5. Alinhamento de Produtores', false, err.message);
  }

  // 6. Alinhamento de Vendas, Corretagem e Intermediação (POST /sales-orders/calculate)
  try {
    const res = await fetch(`${apiUrl}/sales-orders/calculate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        saleType: 'intermediacao',
        items: [{ quantityBags: 100, bagWeightKg: 25, pricePerBag: 120 }],
        brokerageFeeType: 'percentage',
        brokerageFeeValue: 2.5,
        brokeragePayer: 'producer'
      })
    });
    const calc = await res.json();
    log('6. Alinhamento de Vendas & Corretagem (/sales-orders/calculate)', res.ok && calc.brokerageAmount === 300, `Comissão Alinhada: R$ ${calc.brokerageAmount}`);
  } catch (err) {
    log('6. Alinhamento de Vendas & Corretagem', false, err.message);
  }

  // 7. Alinhamento do Módulo Financeiro & Alertas da Agenda (GET /payments/alerts)
  try {
    const res = await fetch(`${apiUrl}/payments/alerts`, { headers });
    const alerts = await res.json();
    const isAligned = res.ok && Array.isArray(alerts.receivablesOverdue) && Array.isArray(alerts.payablesOverdue);
    log('7. Alinhamento da Agenda & Alertas da Tela (GET /payments/alerts)', isAligned, `Alertas e Vencimentos Estruturados`);
  } catch (err) {
    log('7. Alinhamento da Agenda & Alertas da Tela', false, err.message);
  }

  // 8. Alinhamento do Módulo de Fluxo de Caixa (GET /payments/summary)
  try {
    const res = await fetch(`${apiUrl}/payments/summary`, { headers });
    const summary = await res.json();
    const isAligned = res.ok && typeof summary.receivableOpenAmount === 'number';
    log('8. Alinhamento do Fluxo de Caixa (GET /payments/summary)', isAligned, `Resumo Consolidado`);
  } catch (err) {
    log('8. Alinhamento do Fluxo de Caixa', false, err.message);
  }

  // 9. Alinhamento de Relatórios da Loja (GET /dashboard/loja-pdf-data)
  try {
    const res = await fetch(`${apiUrl}/dashboard/loja-pdf-data`, { headers });
    const pdfData = await res.json();
    const isAligned = res.ok && Array.isArray(pdfData.data || pdfData);
    log('9. Alinhamento de Relatórios de Loja e Produtor (GET /dashboard/loja-pdf-data)', isAligned, `Dados Estruturados e Prontos`);
  } catch (err) {
    log('9. Alinhamento de Relatórios de Loja e Produtor', false, err.message);
  }

  // 10. Alinhamento do Módulo Fiscal (GET /fiscal-documents)
  try {
    const res = await fetch(`${apiUrl}/fiscal-documents`, { headers });
    const docs = await res.json();
    log('10. Alinhamento do Módulo Fiscal (GET /fiscal-documents)', Array.isArray(docs), `${docs.length} documentos fiscais`);
  } catch (err) {
    log('10. Alinhamento do Módulo Fiscal', false, err.message);
  }

  console.log('\n========================================================================================');
  console.log(`RESUMO DO ALINHAMENTO SISTÊMICO: ${passedTests} MÓDULOS ALINHADOS / ${failedTests} FALHAS`);
  console.log('========================================================================================\n');
}

runMasterAlignmentAudit().catch(console.error);
