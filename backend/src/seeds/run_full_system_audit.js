const apiUrl = process.env.API_URL || 'http://localhost:3001';

async function runAudit() {
  console.log('====================================================');
  console.log('     AUDITORIA E SUÍTE DE TESTES COMPLETA DO SISTEMA  ');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;
  const results = [];

  function logResult(testName, success, details = '') {
    if (success) {
      passedTests++;
      console.log(`[PASSED] ✅ ${testName} ${details ? '- ' + details : ''}`);
      results.push({ testName, status: 'PASSED', details });
    } else {
      failedTests++;
      console.error(`[FAILED] ❌ ${testName} ${details ? '- ' + details : ''}`);
      results.push({ testName, status: 'FAILED', details });
    }
  }

  let accessToken = '';

  // 1. Teste de Autenticação Básica (Admin)
  try {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!' })
    });
    const data = await res.json();
    if (res.ok && data.accessToken) {
      accessToken = data.accessToken;
      logResult('1. Autenticação de Usuário Admin (POST /auth/login)', true, `Token emitido com sucesso`);
    } else if (data.require2FA) {
      const res2FA = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!', twoFactorCode: '123456' })
      });
      const data2FA = await res2FA.json();
      if (res2FA.ok && data2FA.accessToken) {
        accessToken = data2FA.accessToken;
        logResult('1. Autenticação de Usuário Admin (2FA em 2 Etapas)', true, `Token 2FA emitido com sucesso`);
      } else {
        logResult('1. Autenticação de Usuário Admin', false, JSON.stringify(data2FA));
      }
    } else {
      logResult('1. Autenticação de Usuário Admin', false, JSON.stringify(data));
    }
  } catch (err) {
    logResult('1. Autenticação de Usuário Admin', false, err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };

  // 2. Teste da API /users (Gestão de Usuários)
  try {
    const res = await fetch(`${apiUrl}/users`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('2. Módulo de Usuários (GET /users)', true, `${data.length} usuário(s) ativos encontrados`);
    } else {
      logResult('2. Módulo de Usuários (GET /users)', false, res.statusText);
    }
  } catch (err) {
    logResult('2. Módulo de Usuários (GET /users)', false, err.message);
  }

  // 3. Teste da API /sales-orders (Histórico e Lançamento de Vendas)
  try {
    const res = await fetch(`${apiUrl}/sales-orders`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('3. Módulo de Vendas (GET /sales-orders)', true, `${data.length} ordem(ns) de venda cadastradas`);
    } else {
      logResult('3. Módulo de Vendas (GET /sales-orders)', false, res.statusText);
    }
  } catch (err) {
    logResult('3. Módulo de Vendas (GET /sales-orders)', false, err.message);
  }

  // 4. Teste da API /purchase-orders (Compras)
  try {
    const res = await fetch(`${apiUrl}/purchase-orders`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('4. Módulo de Compras (GET /purchase-orders)', true, `${data.length} ordem(ns) de compra cadastradas`);
    } else {
      logResult('4. Módulo de Compras (GET /purchase-orders)', false, res.statusText);
    }
  } catch (err) {
    logResult('4. Módulo de Compras (GET /purchase-orders)', false, err.message);
  }

  // 5. Teste do Módulo Financeiro e Agenda (GET /payments)
  try {
    const res = await fetch(`${apiUrl}/payments`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('5. Módulo Financeiro - Listagem de Títulos (GET /payments)', true, `${data.length} título(s) financeiros ativos`);
    } else {
      logResult('5. Módulo Financeiro - Listagem de Títulos', false, res.statusText);
    }
  } catch (err) {
    logResult('5. Módulo Financeiro - Listagem de Títulos', false, err.message);
  }

  // 6. Teste de Alertas Financeiros (GET /payments/alerts)
  try {
    const res = await fetch(`${apiUrl}/payments/alerts`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && data.receivablesOverdue && data.payablesOverdue) {
      const overdueCount = data.receivablesOverdue.length + data.payablesOverdue.length;
      logResult('6. Módulo Financeiro - Alertas da Agenda (GET /payments/alerts)', true, `${overdueCount} alerta(s) de vencimento calculados`);
    } else {
      logResult('6. Módulo Financeiro - Alertas da Agenda', false, res.statusText);
    }
  } catch (err) {
    logResult('6. Módulo Financeiro - Alertas da Agenda', false, err.message);
  }

  // 7. Teste de Fluxo de Caixa (GET /payments/summary)
  try {
    const res = await fetch(`${apiUrl}/payments/summary`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok) {
      logResult('7. Módulo Financeiro - Resumo de Fluxo de Caixa (GET /payments/summary)', true, `Resumo compilado com sucesso`);
    } else {
      logResult('7. Módulo Financeiro - Resumo de Fluxo de Caixa', false, res.statusText);
    }
  } catch (err) {
    logResult('7. Módulo Financeiro - Resumo de Fluxo de Caixa', false, err.message);
  }

  // 8. Teste de Clientes (GET /customers)
  try {
    const res = await fetch(`${apiUrl}/customers`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('8. Módulo de Parceiros - Clientes (GET /customers)', true, `${data.length} cliente(s) cadastrado(s)`);
    } else {
      logResult('8. Módulo de Parceiros - Clientes', false, res.statusText);
    }
  } catch (err) {
    logResult('8. Módulo de Parceiros - Clientes', false, err.message);
  }

  // 9. Teste de Produtores (GET /producers)
  try {
    const res = await fetch(`${apiUrl}/producers`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('9. Módulo de Parceiros - Produtores (GET /producers)', true, `${data.length} produtor(es) cadastrado(s)`);
    } else {
      logResult('9. Módulo de Parceiros - Produtores', false, res.statusText);
    }
  } catch (err) {
    logResult('9. Módulo de Parceiros - Produtores', false, err.message);
  }

  // 10. Teste de Produtos (GET /products)
  try {
    const res = await fetch(`${apiUrl}/products`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('10. Módulo de Produtos (GET /products)', true, `${data.length} produto(s) cadastrado(s)`);
    } else {
      logResult('10. Módulo de Produtos (GET /products)', false, res.statusText);
    }
  } catch (err) {
    logResult('10. Módulo de Produtos (GET /products)', false, err.message);
  }

  // 11. Teste de Documentos Fiscais (GET /fiscal-documents)
  try {
    const res = await fetch(`${apiUrl}/fiscal-documents`, { headers: authHeaders });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      logResult('11. Módulo Fiscal (GET /fiscal-documents)', true, `${data.length} documento(s) fiscal(is)`);
    } else {
      logResult('11. Módulo Fiscal (GET /fiscal-documents)', false, res.statusText);
    }
  } catch (err) {
    logResult('11. Módulo Fiscal (GET /fiscal-documents)', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`RESUMO DA AUDITORIA: ${passedTests} TESTES APROVADOS / ${failedTests} FALHAS`);
  console.log('====================================================\n');
}

runAudit().catch(console.error);
