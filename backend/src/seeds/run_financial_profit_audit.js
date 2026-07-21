const apiUrl = process.env.API_URL || 'http://localhost:3001';

async function runFinancialProfitAudit() {
  console.log('====================================================================');
  console.log('     AUDITORIA DE APURAÇÃO DE LUCROS, FLUXO DE CAIXA E RELATÓRIOS  ');
  console.log('====================================================================\n');

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
  // 1. Authenticate
  try {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@agrovenda.local', password: 'Admin123!' })
    });
    const data = await res.json();
    token = data.accessToken;
    log('1. Autenticação Administrativa', !!token, token ? 'Token Válido' : 'Falha');
  } catch (err) {
    log('1. Autenticação Administrativa', false, err.message);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Test Sales Order Calculation Engine (Apuração de Margem e Corretagem)
  try {
    const calcRes = await fetch(`${apiUrl}/sales-orders/calculate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        saleType: 'compra_venda',
        items: [{
          quantityBags: 100,
          bagWeightKg: 25,
          pricePerBag: 150.00, // Venda = 15.000,00
          costPerBag: 130.00,  // Custo = 13.000,00 -> Lucro esperado = 2.000,00 menos Funrural
        }],
        brokerageFeeType: 'percentage',
        brokerageFeeValue: 2.0,
      })
    });
    const calc = await calcRes.json();
    if (calcRes.ok && calc.totalParticularAmount === 15000 && calc.totalCostAmount === 13000) {
      log('2. Motor de Apuração de Venda (Custo x Venda x Retenções)', true, `Venda: R$ 15.000 | Custo: R$ 13.000 | Pagar Produtor: R$ ${calc.producerNetAmount}`);
    } else {
      log('2. Motor de Apuração de Venda', false, JSON.stringify(calc));
    }
  } catch (err) {
    log('2. Motor de Apuração de Venda', false, err.message);
  }

  // 3. Test Intermediação / Corretagem Calculation
  try {
    const calcBrokerageRes = await fetch(`${apiUrl}/sales-orders/calculate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        saleType: 'intermediacao',
        items: [{
          quantityBags: 200,
          bagWeightKg: 25,
          pricePerBag: 100.00, // Total = 20.000,00
        }],
        brokerageFeeType: 'percentage',
        brokerageFeeValue: 3.0, // 3% de 20.000 = 600,00 de Comissão
        brokeragePayer: 'producer'
      })
    });
    const calcB = await calcBrokerageRes.json();
    if (calcBrokerageRes.ok && calcB.brokerageAmount === 600) {
      log('3. Apuração de Comissão de Corretagem (Intermediação 3%)', true, `Comissão Apurada: R$ ${calcB.brokerageAmount}`);
    } else {
      log('3. Apuração de Comissão de Corretagem', false, JSON.stringify(calcB));
    }
  } catch (err) {
    log('3. Apuração de Comissão de Corretagem', false, err.message);
  }

  // 4. Test Fluxo de Caixa Endpoint (/payments/summary)
  try {
    const summaryRes = await fetch(`${apiUrl}/payments/summary`, { headers });
    const summary = await summaryRes.json();
    if (summaryRes.ok && typeof summary.receivableOpenAmount === 'number' && typeof summary.payableOpenAmount === 'number') {
      log('4. Apuração de Fluxo de Caixa (/payments/summary)', true, `A Receber: R$ ${summary.receivableOpenAmount} | A Pagar: R$ ${summary.payableOpenAmount}`);
    } else {
      log('4. Apuração de Fluxo de Caixa', false, JSON.stringify(summary));
    }
  } catch (err) {
    log('4. Apuração de Fluxo de Caixa', false, err.message);
  }

  // 5. Test Dados do Relatório de Loja (/dashboard/loja-pdf-data)
  try {
    const pdfDataRes = await fetch(`${apiUrl}/dashboard/loja-pdf-data`, { headers });
    const pdfData = await pdfDataRes.json();
    if (pdfDataRes.ok && Array.isArray(pdfData.data || pdfData)) {
      const itemsCount = (pdfData.data || pdfData).length;
      log('5. Consolidação de Dados do Relatório de Loja (/dashboard/loja-pdf-data)', true, `${itemsCount} registros consolidados com sucesso`);
    } else {
      log('5. Consolidação de Dados do Relatório de Loja', false, JSON.stringify(pdfData));
    }
  } catch (err) {
    log('5. Consolidação de Dados do Relatório de Loja', false, err.message);
  }

  console.log('\n====================================================================');
  console.log(`RESUMO DA AUDITORIA FINANCEIRA: ${passedTests} TESTES APROVADOS / ${failedTests} FALHAS`);
  console.log('====================================================================\n');
}

runFinancialProfitAudit().catch(console.error);
