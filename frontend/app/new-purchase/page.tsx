'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

type Option = { _id: string; name: string; city?: string; state?: string };

type PurchaseItem = {
  id: string;
  productId: string;
  quantityBags: number;
  bagWeightKg: number;
  costPerBag: number;
};

type CalculationItem = Omit<PurchaseItem, 'id'> & {
  quantityKg: number;
  lineTotal: number;
};

type Calculation = {
  items: CalculationItem[];
  totalBags: number;
  totalKg: number;
  totalAmount: number;
  funruralRate: number;
  funruralSocialSecurityRate: number;
  funruralRatRate: number;
  funruralSenarRate: number;
  funruralSocialSecurityAmount: number;
  funruralRatAmount: number;
  funruralSenarAmount: number;
  funruralRetentionAmount: number;
  producerNetAmount: number;
};

type DraftPurchase = {
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

export default function NewPurchasePage() {
  const [products, setProducts] = useState<Option[]>([]);
  const [producers, setProducers] = useState<Option[]>([]);
  const [date, setDate] = useState(today);
  const [producerId, setProducerId] = useState('');
  const [originLocation, setOriginLocation] = useState('');
  
  // Condição de pagamento Produtor
  const [paymentOption, setPaymentOption] = useState('cash');
  const [customTermDays, setCustomTermDays] = useState(0);
  const [customDueDate, setCustomDueDate] = useState(today);

  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([{
    id: Date.now().toString(),
    productId: '',
    quantityBags: 0,
    bagWeightKg: 25,
    costPerBag: 0,
  }]);
  
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void Promise.all([
      apiGet<Option[]>('/products').then(setProducts).catch(() => setProducts([])),
      apiGet<Option[]>('/producers').then(setProducers).catch(() => setProducers([])),
    ]);
  }, []);

  useEffect(() => {
    apiPost<Calculation>('/purchase-orders/calculate', {
      items: items.map(({ productId, quantityBags, bagWeightKg, costPerBag }) => ({
        productId,
        quantityBags,
        bagWeightKg,
        costPerBag,
      })),
    })
      .then(setCalculation)
      .catch(() => setCalculation(null));
  }, [items]);

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
      costPerBag: 0,
    }]);
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    setItems(current => current.filter(item => item.id !== id));
  }

  function updateItem(id: string, field: keyof PurchaseItem, value: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: field === 'productId' ? value : Number(value) } : item,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (items.some(item => !item.productId)) {
      setMessage('Selecione o produto para todos os itens.');
      return;
    }

    try {
      const created = await apiPost<{ _id: string; orderNumber: string }>('/purchase-orders', {
        date,
        producerId,
        originLocation,
        paymentType,
        termDays,
        dueDate,
        dueDateManual: paymentOption === 'custom',
        items: items.map(({ productId, quantityBags, bagWeightKg, costPerBag }) => ({
          productId,
          quantityBags,
          bagWeightKg,
          costPerBag,
        })),
        notes,
      });
      setMessage(`Compra ${created.orderNumber} confirmada com sucesso.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao confirmar compra.');
    }
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link> / <Link href="/compras">Compras</Link></p>
          <h1>Nova Compra (Entrada)</h1>
        </div>
        <Link className="link-action" href="/compras">Ver compras</Link>
      </section>

      <form className="sale-layout wide-sale-layout" onSubmit={submit}>
        <div className="stack">
          <section className="panel form-section">
            <h2>Dados Gerais</h2>
            <div className="form-grid">
              <label>Data da compra
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </label>
              <label>Produtor
                <select value={producerId} onChange={(event) => setProducerId(event.target.value)} required>
                  <option value="">Selecione</option>
                  {producers.map((producer) => <option key={producer._id} value={producer._id}>{producer.name}</option>)}
                </select>
              </label>
              <label>Local de Origem (Fazenda)
                <input value={originLocation} onChange={(event) => setOriginLocation(event.target.value)} />
              </label>
              <label className="wide">Observações
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="panel form-section">
            <h2>Condição de Pagamento ao Produtor</h2>
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
              <label>Vencimento do Pagamento
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
              <h2>Itens da Compra</h2>
              <button type="button" onClick={addItem} className="btn outline" style={{ fontSize: '13px' }}>+ Adicionar Produto</button>
            </div>
            <div className="items-table" style={{ marginTop: '1rem' }}>
              <div className="items-row items-head">
                <span>Produto</span>
                <span>Sacos</span>
                <span>Kg</span>
                <span>Custo por saca</span>
                <span>Total</span>
                <span></span>
              </div>
              {items.map((item, index) => {
                const calculated = calculation?.items[index];
                return (
                  <div className="items-row" key={item.id}>
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
                    <input
                      aria-label={`Custo por saco linha ${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.costPerBag}
                      onChange={(event) => updateItem(item.id, 'costPerBag', event.target.value)}
                    />
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
            <dl>
              <dt>Total de sacos comprados</dt><dd>{calculation.totalBags}</dd>
              <dt>Total em kg</dt><dd>{formatKg(calculation.totalKg)}</dd>
              <dt>Custo total Bruto</dt>
              <dd>{money(calculation.totalAmount)}</dd>
              <dt>FUNRURAL 1,50%</dt><dd>{money(calculation.funruralRetentionAmount)}</dd>
              <dt>Líquido a Pagar ao Produtor</dt>
              <dd>{money(calculation.producerNetAmount)}</dd>
            </dl>
          ) : <p className="empty">Informe os valores para calcular.</p>}
          <button className="primary-action full" type="submit">Confirmar Compra</button>
          {message ? <p className="message">{message}</p> : null}
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
