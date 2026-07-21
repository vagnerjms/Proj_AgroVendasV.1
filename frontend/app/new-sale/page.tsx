'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { toast } from 'react-toastify';
import { apiGet, apiPost, authFetch } from '../../lib/api';

type Option = { _id: string; name: string; city?: string; state?: string };

type SaleItem = {
  id: string;
  productId: string;
  quantityBags: number;
  bagWeightKg: number;
  pricePerBag: number;
  costPerBag: number;
};

type CalculationItem = Omit<SaleItem, 'id'> & {
  quantityKg: number;
  lineTotal: number;
};

type Calculation = {
  items: CalculationItem[];
  totalBags: number;
  totalKg: number;
  totalParticularAmount: number;
  totalCostAmount?: number;
  funruralRate: number;
  funruralSocialSecurityRate: number;
  funruralRatRate: number;
  funruralSenarRate: number;
  funruralSocialSecurityAmount: number;
  funruralRatAmount: number;
  funruralSenarAmount: number;
  funruralRetentionAmount: number;
  totalReceivableAmount: number;
  producerNetAmount?: number;
  brokerageAmount?: number;
};

type DraftSale = {
  id: string;
  _id: string;
  orderNumber: string;
  status: string;
};

const paymentOptions = [
  { label: 'À vista', value: 'cash', days: 0 },
  { label: '15 dias', value: '15', days: 15 },
  { label: '30 dias', value: '30', days: 30 },
  { label: '40 dias', value: '40', days: 40 },
  { label: '45 dias', value: '45', days: 45 },
  { label: '60 dias', value: '60', days: 60 },
  { label: '90 dias', value: '90', days: 90 },
  { label: 'Personalizado', value: 'custom', days: undefined },
];

const today = new Date().toISOString().slice(0, 10);


export default function NewSalePage() {
  const [products, setProducts] = useState<Option[]>([]);
  const [producers, setProducers] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [date, setDate] = useState(today);
  const [producerId, setProducerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [originLocation, setOriginLocation] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [saleType, setSaleType] = useState<'particular' | 'compra_venda' | 'intermediacao' | 'venda_estoque'>('compra_venda');
  const [brokerageFeeType, setBrokerageFeeType] = useState<'fixed' | 'percentage'>('percentage');
  const [brokerageFeeValue, setBrokerageFeeValue] = useState<number>(0);
  const [brokeragePayer, setBrokeragePayer] = useState<'producer' | 'customer' | 'both'>('producer');
  
  // Condição de pagamento Cliente
  const [paymentOption, setPaymentOption] = useState('cash');
  const [customTermDays, setCustomTermDays] = useState(0);
  const [customDueDate, setCustomDueDate] = useState(today);

  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<SaleItem[]>([{
    id: Date.now().toString(),
    productId: '',
    quantityBags: 0,
    bagWeightKg: 25,
    pricePerBag: 0,
    costPerBag: 0,
  }]);
  
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void Promise.all([
      apiGet<Option[]>('/products').then(setProducts).catch(() => setProducts([])),
      apiGet<Option[]>('/producers').then(setProducers).catch(() => setProducers([])),
      apiGet<Option[]>('/customers').then(setCustomers).catch(() => setCustomers([])),
    ]);
  }, []);

  useEffect(() => {
    apiPost<Calculation>('/sales-orders/calculate', {
      saleType,
      producerId: saleType !== 'venda_estoque' ? producerId : undefined,
      customerId,
      brokerageFeeType,
      brokerageFeeValue,
      brokeragePayer,
      items: items.map(({ productId, quantityBags, bagWeightKg, pricePerBag, costPerBag }) => ({
        productId,
        quantityBags,
        bagWeightKg,
        pricePerBag,
        costPerBag: saleType === 'compra_venda' ? costPerBag : undefined,
      })),
    })
      .then(setCalculation)
      .catch(() => setCalculation(null));
  }, [items, saleType, producerId, customerId, brokerageFeeType, brokerageFeeValue, brokeragePayer]);

  const selectedPayment = useMemo(
    () => paymentOptions.find((option) => option.value === paymentOption) ?? paymentOptions[0],
    [paymentOption],
  );

  const termDays = paymentOption === 'custom' ? customTermDays : selectedPayment.days ?? 0;
  const paymentType = termDays > 0 || paymentOption === 'custom' ? 'term' : 'cash';
  const dueDate = paymentOption === 'custom' ? customDueDate : addDays(date, termDays);

  function addItem() {
    setItems(current => [...current, {
      id: Date.now().toString(),
      productId: '',
      quantityBags: 0,
      bagWeightKg: 25,
      pricePerBag: 0,
      costPerBag: 0,
    }]);
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems(current => current.filter(item => item.id !== id));
  }

  function updateItem(id: string, field: keyof SaleItem, value: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (field === 'productId') {
          const selectedProd = products.find((p: any) => p._id === value) as any;
          const defaultWeight = selectedProd?.defaultWeightKg || item.bagWeightKg || 20;
          return { ...item, productId: value, bagWeightKg: defaultWeight };
        }
        return { ...item, [field]: Number(value) };
      }),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.some(item => !item.productId)) {
      toast.error('Selecione o produto para todos os itens.');
      return;
    }

    try {
      const created = await apiPost<{ _id: string; orderNumber: string }>('/sales-orders', {
        date,
        producerId: saleType !== 'venda_estoque' ? producerId : undefined,
        customerId,
        originLocation,
        destinationCity,
        destinationState,
        saleType,
        brokerageFeeType: saleType === 'intermediacao' ? brokerageFeeType : undefined,
        brokerageFeeValue: saleType === 'intermediacao' ? brokerageFeeValue : undefined,
        brokeragePayer: saleType === 'intermediacao' ? brokeragePayer : undefined,
        paymentType,
        termDays,
        dueDate,
        dueDateManual: paymentOption === 'custom',
        items: items.map(({ productId, quantityBags, bagWeightKg, pricePerBag, costPerBag }) => ({
          productId,
          quantityBags,
          bagWeightKg,
          pricePerBag,
          costPerBag: saleType === 'compra_venda' ? costPerBag : undefined,
        })),
        notes,
      });

      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const response = await authFetch(`/sales-orders/${created._id}/files`, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            toast.error(`Erro ao anexar arquivo: ${file.name}`);
          }
        }
      }

      toast.success(`Venda ${created.orderNumber} confirmada com sucesso.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao confirmar venda.');
    }
  }

  return (
    <main className="shell report-shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link> / <Link href="/vendas">Vendas</Link></p>
          <h1>
            {saleType === 'venda_estoque'
              ? 'Venda de Estoque Próprio'
              : saleType === 'intermediacao'
              ? 'Venda por Corretagem / Intermediação'
              : saleType === 'particular'
              ? 'Venda Particular / Repasse Direto'
              : 'Revenda Padrão (Compra e Venda)'}
          </h1>
        </div>
        <Link className="link-action" href="/vendas">Ver vendas</Link>
      </section>

      <form className="sale-layout wide-sale-layout" onSubmit={submit}>
        <div className="stack">
          <section className="panel form-section">
            <h2>Dados Gerais</h2>
            <div className="form-grid">
              <label>Tipo de Operação
                <select value={saleType} onChange={(event) => setSaleType(event.target.value as any)}>
                  <option value="compra_venda">Revenda Padrão (Compra e Venda)</option>
                  <option value="intermediacao">Intermediação (Corretagem / Comissão)</option>
                  <option value="particular">Venda Particular / Repasse Direto</option>
                  <option value="venda_estoque">Venda de Estoque Próprio</option>
                </select>
              </label>
              <label>Data da venda
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </label>
              {saleType !== 'venda_estoque' && (
                <label>Produtor
                  <select value={producerId} onChange={(event) => setProducerId(event.target.value)} required>
                    <option value="">Selecione</option>
                    {producers.map((producer) => <option key={producer._id} value={producer._id}>{producer.name}</option>)}
                  </select>
                </label>
              )}
              <label>Cliente
                <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                  <option value="">Selecione</option>
                  {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
                </select>
              </label>
              <label>Origem
                <input value={originLocation} onChange={(event) => setOriginLocation(event.target.value)} />
              </label>
              <label>Cidade destino
                <input value={destinationCity} onChange={(event) => setDestinationCity(event.target.value)} required />
              </label>
              <label>UF destino
                <input
                  maxLength={2}
                  value={destinationState}
                  onChange={(event) => setDestinationState(event.target.value.toUpperCase())}
                  required
                />
              </label>
              <label className="wide" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>Observacoes</span>
                  <label style={{ cursor: 'pointer', fontSize: '13px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    {files.length > 0 ? `${files.length} selecionado(s)` : 'Anexar Arquivo'}
                    <input type="file" style={{ display: 'none' }} multiple onChange={(e) => {
                      if (e.target.files) {
                        setFiles(Array.from(e.target.files));
                      }
                    }} />
                  </label>
                </div>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
          </section>

          {saleType === 'intermediacao' && (
            <section className="panel form-section">
              <h2>Comissão (Corretagem)</h2>
              <div className="form-grid">
                <label>Tipo de Taxa
                  <select value={brokerageFeeType} onChange={(event) => setBrokerageFeeType(event.target.value as any)}>
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Fixo por Saca (R$)</option>
                  </select>
                </label>
                <label>Valor / Taxa
                  <NumericFormat
                    value={brokerageFeeValue}
                    onValueChange={(values) => setBrokerageFeeValue(values.floatValue ?? 0)}
                    prefix={brokerageFeeType === 'fixed' ? 'R$ ' : ''}
                    suffix={brokerageFeeType === 'percentage' ? ' %' : ''}
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                  />
                </label>
                <label>Quem Paga?
                  <select value={brokeragePayer} onChange={(e) => setBrokeragePayer(e.target.value as any)}>
                    <option value="producer">Produtor</option>
                    <option value="customer">Cliente</option>
                    <option value="both">Ambos (50/50)</option>
                  </select>
                </label>
              </div>
            </section>
          )}

          <section className="panel form-section">
            <h2>{saleType === 'venda_estoque' ? 'Condição de Recebimento (Cliente)' : 'Condição de Pagamento'}</h2>
            <div className="form-grid">
              <label>Prazo
                <select value={paymentOption} onChange={(event) => setPaymentOption(event.target.value)}>
                  {paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {paymentOption === 'custom' ? (
                <label>Dias personalizados
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={customTermDays}
                    onChange={(event) => {
                      const nextTermDays = Number(event.target.value);
                      setCustomTermDays(nextTermDays);
                      setCustomDueDate(addDays(date, nextTermDays));
                    }}
                  />
                </label>
              ) : null}
              <label>Vencimento
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setCustomDueDate(event.target.value)}
                  readOnly={paymentOption !== 'custom'}
                />
              </label>
            </div>
          </section>

          <section className="panel form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Itens da Venda</h2>
              <button type="button" onClick={addItem} className="btn outline" style={{ fontSize: '13px' }}>+ Adicionar Produto</button>
            </div>
            <div className="items-table" style={{ marginTop: '1rem' }}>
              <div className={`items-row items-head`} style={{ gridTemplateColumns: saleType === 'compra_venda' ? '2fr 1fr 1fr 1.5fr 1.5fr 1.5fr 40px' : '2fr 1fr 1fr 1.5fr 1.5fr 40px' }}>
                <span>Produto</span>
                <span>Sacos</span>
                <span>Kg</span>
                <span>Valor por saca</span>
                {saleType === 'compra_venda' && <span>Custo por saca</span>}
                <span>Total</span>
                <span></span>
              </div>
              {items.map((item, index) => {
                const calculated = calculation?.items[index];
                return (
                  <div className="items-row" key={item.id} style={{ gridTemplateColumns: saleType === 'compra_venda' ? '2fr 1fr 1fr 1.5fr 1.5fr 1.5fr 40px' : '2fr 1fr 1fr 1.5fr 1.5fr 40px' }}>
                    <select 
                      value={item.productId} 
                      onChange={(event) => updateItem(item.id, 'productId', event.target.value)}
                      required
                    >
                      <option value="">Selecione...</option>
                      {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                    </select>
                    <input
                      aria-label={`Sacos linha ${index + 1}`}
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantityBags}
                      onChange={(event) => updateItem(item.id, 'quantityBags', event.target.value)}
                    />
                    <span>{formatKg(calculated?.quantityKg ?? item.quantityBags * item.bagWeightKg)}</span>
                    <NumericFormat
                      aria-label={`Valor por saco linha ${index + 1}`}
                      value={item.pricePerBag}
                      onValueChange={(values) => updateItem(item.id, 'pricePerBag', String(values.floatValue ?? 0))}
                      prefix="R$ "
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                    />
                    {saleType === 'compra_venda' && (
                      <NumericFormat
                        aria-label={`Custo por saco linha ${index + 1}`}
                        value={item.costPerBag}
                        onValueChange={(values) => updateItem(item.id, 'costPerBag', String(values.floatValue ?? 0))}
                        prefix="R$ "
                        thousandSeparator="."
                        decimalSeparator=","
                        decimalScale={2}
                        fixedDecimalScale
                        allowNegative={false}
                      />
                    )}
                    <span>{money(calculated?.lineTotal ?? 0)}</span>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="calc-panel">
          <h2>Resumo Financeiro</h2>
          {calculation ? (
            <>
              <dl>
                <dt>Total de sacos</dt><dd>{calculation.totalBags}</dd>
                <dt>Total em kg</dt><dd>{formatKg(calculation.totalKg)}</dd>
                <dt>{saleType === 'venda_estoque' ? 'Valor bruto da Venda' : 'Total da Operação'}</dt>
                <dd>{money(calculation.totalParticularAmount)}</dd>
                {saleType === 'intermediacao' && (
                  <>
                    <dt>Total Comissão</dt>
                    <dd>{money(calculation.brokerageAmount ?? 0)}</dd>
                  </>
                )}
                {saleType === 'compra_venda' && (
                  <>
                    <dt>Custo total dos lotes</dt>
                    <dd>{money(calculation.totalCostAmount ?? 0)}</dd>
                    <dt style={{ fontWeight: 'bold', color: '#2f7a45' }}>Lucro Bruto (Margem)</dt>
                    <dd style={{ fontWeight: 'bold', color: '#2f7a45' }}>
                      {money(calculation.totalParticularAmount - (calculation.totalCostAmount ?? 0))}
                    </dd>
                  </>
                )}
                <dt style={{ fontWeight: 'bold' }}>FUNRURAL (Total {(calculation.funruralRate * 100).toFixed(2).replace('.', ',')}%)</dt>
                <dd style={{ fontWeight: 'bold' }}>{money(calculation.funruralRetentionAmount)}</dd>
                <div style={{ paddingLeft: '1rem', fontSize: '0.9em', color: '#666', borderLeft: '2px solid #eee', marginLeft: '0.5rem', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>↳ Previdência Social {(calculation.funruralSocialSecurityRate * 100).toFixed(2).replace('.', ',')}%</span>
                    <span>{money(calculation.funruralSocialSecurityAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>↳ RAT {(calculation.funruralRatRate * 100).toFixed(2).replace('.', ',')}%</span>
                    <span>{money(calculation.funruralRatAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>↳ SENAR {(calculation.funruralSenarRate * 100).toFixed(2).replace('.', ',')}%</span>
                    <span>{money(calculation.funruralSenarAmount)}</span>
                  </div>
                </div>
                {saleType === 'venda_estoque' && (
                  <>
                    <dt>Total a Receber do Cliente</dt><dd>{money(calculation.totalReceivableAmount)}</dd>
                  </>
                )}
                {(saleType === 'particular' || saleType === 'compra_venda') && (
                  <>
                    <dt>Total a Receber do Cliente</dt><dd>{money(calculation.totalReceivableAmount)}</dd>
                  </>
                )}
              </dl>

              {saleType === 'particular' && (
                <div className="payout-highlight-box">
                  <span className="payout-label">Total Líquido Produtor</span>
                  <span className="payout-value">{money(calculation.producerNetAmount ?? 0)}</span>
                </div>
              )}

              {saleType === 'compra_venda' && (
                <div className="payout-highlight-box">
                  <span className="payout-label">A Pagar ao Produtor (Líquido)</span>
                  <span className="payout-value">{money(calculation.producerNetAmount ?? 0)}</span>
                </div>
              )}
            </>
          ) : <p className="empty">Informe os valores para calcular.</p>}
          <button className="primary-action full" type="submit">Confirmar venda</button>
        </aside>
      </form>
    </main>
  );
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00`);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatKg(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
}
