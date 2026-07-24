'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { toast } from 'react-toastify';
import { apiGet, apiPatch, apiPost, authFetch } from '../../../../lib/api';

type Option = { _id: string; name: string; city?: string; state?: string };

type SaleItem = {
  id: string;
  productId: string;
  quantityBags: number;
  bagWeightKg: number;
  pricePerBag: number;
  costPerBag: number;
  quantityKg?: number;
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

export default function EditSalePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Option[]>([]);
  const [producers, setProducers] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  
  const [orderNumber, setOrderNumber] = useState('');
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
  const [items, setItems] = useState<SaleItem[]>([]);
  
  const [calculation, setCalculation] = useState<Calculation | null>(null);

  // Load select options and the sale order details
  useEffect(() => {
    async function loadData() {
      try {
        const [prodOptions, producerOptions, customerOptions, saleData] = await Promise.all([
          apiGet<Option[]>('/products').catch(() => []),
          apiGet<Option[]>('/producers').catch(() => []),
          apiGet<Option[]>('/customers').catch(() => []),
          apiGet<any>(`/sales-orders/${params.id}`),
        ]);

        setProducts(prodOptions);
        setProducers(producerOptions);
        setCustomers(customerOptions);

        if (saleData) {
          setOrderNumber(saleData.orderNumber || '');
          setDate(saleData.date ? saleData.date.slice(0, 10) : today);
          setProducerId(saleData.producerId?._id || saleData.producerId || '');
          setCustomerId(saleData.customerId?._id || saleData.customerId || '');
          setOriginLocation(saleData.originLocation || '');
          setDestinationCity(saleData.destinationCity || '');
          setDestinationState(saleData.destinationState || '');
          setSaleType(saleData.saleType || 'compra_venda');
          setBrokerageFeeType(saleData.brokerageFeeType || 'percentage');
          setBrokerageFeeValue(saleData.brokerageFeeValue || 0);
          setBrokeragePayer(saleData.brokeragePayer || 'producer');
          setNotes(saleData.notes || '');

          // Determine payment option based on termDays
          const term = saleData.termDays || 0;
          if (saleData.dueDateManual) {
            setPaymentOption('custom');
            setCustomTermDays(term);
            setCustomDueDate(saleData.dueDate ? saleData.dueDate.slice(0, 10) : today);
          } else {
            const matchedOption = paymentOptions.find(opt => opt.value === String(term));
            if (matchedOption) {
              setPaymentOption(matchedOption.value);
            } else {
              setPaymentOption('custom');
              setCustomTermDays(term);
              setCustomDueDate(saleData.dueDate ? saleData.dueDate.slice(0, 10) : today);
            }
          }

          // Format items
          const formattedItems = (saleData.items || []).map((item: any, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            productId: item.productId?._id || item.productId || '',
            quantityBags: item.quantityBags || 0,
            bagWeightKg: item.bagWeightKg || 25,
            pricePerBag: item.pricePerBag || 0,
            costPerBag: item.costPerBag || 0,
            quantityKg: item.quantityKg,
          }));
          setItems(formattedItems.length ? formattedItems : [{
            id: Date.now().toString(),
            productId: '',
            quantityBags: 0,
            bagWeightKg: 25,
            pricePerBag: 0,
            costPerBag: 0,
          }]);
        }
      } catch (err) {
        toast.error('Erro ao carregar dados da venda.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      void loadData();
    }
  }, [params.id]);

  // Recalculate reactively
  useEffect(() => {
    if (loading || !items.length) return;

    apiPost<Calculation>('/sales-orders/calculate', {
      saleType,
      producerId: saleType !== 'venda_estoque' ? producerId : undefined,
      customerId,
      brokerageFeeType,
      brokerageFeeValue,
      brokeragePayer,
      items: items.map(({ productId, quantityBags, bagWeightKg, pricePerBag, costPerBag, quantityKg }) => ({
        productId,
        quantityBags,
        bagWeightKg,
        pricePerBag,
        costPerBag: saleType === 'compra_venda' ? costPerBag : undefined,
        quantityKg,
      })),
    })
      .then(setCalculation)
      .catch(() => setCalculation(null));
  }, [items, saleType, producerId, customerId, brokerageFeeType, brokerageFeeValue, brokeragePayer, loading]);

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
          return { ...item, productId: value, bagWeightKg: defaultWeight, quantityKg: undefined };
        }
        if (field === 'quantityBags') {
          return { ...item, quantityBags: value === '' ? 0 : Number(value), quantityKg: undefined };
        }
        return { ...item, [field]: value === '' ? undefined : Number(value) };
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
      await apiPatch<{ _id: string; orderNumber: string }>(`/sales-orders/${params.id}`, {
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
        items: items.map(({ productId, quantityBags, bagWeightKg, pricePerBag, costPerBag, quantityKg }) => ({
          productId,
          quantityBags,
          bagWeightKg,
          pricePerBag,
          costPerBag: saleType === 'compra_venda' ? costPerBag : undefined,
          quantityKg,
        })),
        notes,
      });

      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const response = await authFetch(`/sales-orders/${params.id}/files`, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            toast.error(`Erro ao anexar arquivo: ${file.name}`);
          }
        }
      }

      toast.success(`Venda ${orderNumber} atualizada com sucesso.`);
      router.push(`/vendas/${params.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar alterações da venda.');
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p><Link href="/vendas">Voltar</Link></p>
        <p className="empty">Carregando dados da venda...</p>
      </main>
    );
  }

  return (
    <main className="shell report-shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link> / <Link href="/vendas">Vendas</Link> / <Link href={`/vendas/${params.id}`}>{orderNumber}</Link></p>
          <h1>Editar Venda: {orderNumber}</h1>
        </div>
        <Link className="link-action" href={`/vendas/${params.id}`}>Cancelar</Link>
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
                  <span>Observações (Adicionar novos anexos abaixo)</span>
                  <label style={{ cursor: 'pointer', fontSize: '13px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    {files.length > 0 ? `${files.length} selecionado(s)` : 'Anexar Novo Arquivo'}
                    <input type="file" style={{ display: 'none' }} multiple onChange={(e) => {
                      if (e.target.files) {
                        setFiles(Array.from(e.target.files));
                      }
                    }} />
                  </label>
                </div>
                <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="panel form-section">
            <h2>Itens da Venda</h2>
            <div className="items-table">
              <div className={`items-row items-head ${saleType === 'compra_venda' ? 'compra-venda-row' : ''}`}>
                <span>Produto</span>
                <span>Qtd</span>
                <span>Peso Unit.</span>
                <span>Total kg</span>
                {saleType === 'compra_venda' && <span>Custo Unit.</span>}
                <span>Valor Unit.</span>
                <span>Ações</span>
              </div>
              {items.map((item) => {
                const selectedProd = products.find((p) => p._id === item.productId) as any;
                const unit = selectedProd?.defaultUnit || 'saco';
                const getUnitSuffix = () => {
                  if (unit === 'caixa') return 'cx';
                  if (unit === 'saco' || unit === 'saca') return 'sc';
                  if (unit === 'pacote') return 'pct';
                  if (unit === 'kg') return 'kg';
                  if (unit === 'unidade') return 'un';
                  if (unit === 'tonelada') return 't';
                  return unit;
                };

                const calcQtyKg = item.quantityKg !== undefined ? item.quantityKg : (item.quantityBags * item.bagWeightKg);

                return (
                  <div className={`items-row ${saleType === 'compra_venda' ? 'compra-venda-row' : ''}`} key={item.id}>
                    <select
                      value={item.productId}
                      onChange={(event) => updateItem(item.id, 'productId', event.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                    </select>
                    <label className="input-group">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={item.quantityBags || ''}
                        onChange={(event) => updateItem(item.id, 'quantityBags', event.target.value)}
                        required
                      />
                      <span>{getUnitSuffix()}</span>
                    </label>
                    <label className="input-group">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={item.bagWeightKg || ''}
                        onChange={(event) => updateItem(item.id, 'bagWeightKg', event.target.value)}
                        required
                      />
                      <span>kg</span>
                    </label>
                    <input
                      type="text"
                      value={calcQtyKg.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' kg'}
                      disabled
                    />
                    {saleType === 'compra_venda' && (
                      <NumericFormat
                        value={item.costPerBag || ''}
                        prefix="R$ "
                        thousandSeparator="."
                        decimalSeparator=","
                        decimalScale={2}
                        fixedDecimalScale
                        allowNegative={false}
                        onValueChange={(values) => {
                          updateItem(item.id, 'costPerBag', String(values.floatValue || 0));
                        }}
                        placeholder="R$ 0,00"
                        required
                      />
                    )}
                    <NumericFormat
                      value={item.pricePerBag || ''}
                      prefix="R$ "
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      onValueChange={(values) => {
                        updateItem(item.id, 'pricePerBag', String(values.floatValue || 0));
                      }}
                      placeholder="R$ 0,00"
                      required
                    />
                    <button
                      type="button"
                      className="link-action danger"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      Excluir
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="link-action add-item-btn" onClick={addItem}>Adicionar Item</button>
          </section>

          <section className="panel form-section">
            <h2>Prazos e Vencimentos (Cliente)</h2>
            <div className="form-grid">
              <label>Condição de Vencimento
                <select value={paymentOption} onChange={(event) => setPaymentOption(event.target.value)}>
                  {paymentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>

              {paymentOption === 'custom' && (
                <>
                  <label>Dias de prazo
                    <input
                      type="number"
                      min="0"
                      value={customTermDays}
                      onChange={(event) => {
                        const nextTermDays = Number(event.target.value);
                        setCustomTermDays(nextTermDays);
                        setCustomDueDate(addDays(date, nextTermDays));
                      }}
                      required
                    />
                  </label>
                  <label>Data de Vencimento
                    <input
                      type="date"
                      value={customDueDate}
                      onChange={(event) => setCustomDueDate(event.target.value)}
                      required
                    />
                  </label>
                </>
              )}

              {paymentOption !== 'custom' && (
                <label>Data de Vencimento
                  <input type="date" value={dueDate} disabled />
                </label>
              )}
            </div>
          </section>

          {saleType === 'intermediacao' && (
            <section className="panel form-section">
              <h2>Corretagem / Comissão</h2>
              <div className="form-grid">
                <label>Paga por
                  <select value={brokeragePayer} onChange={(e) => setBrokeragePayer(e.target.value as any)}>
                    <option value="producer">Produtor</option>
                    <option value="customer">Cliente</option>
                    <option value="both">Ambos (Meio a Meio)</option>
                  </select>
                </label>
                <label>Tipo de Taxa
                  <select value={brokerageFeeType} onChange={(e) => setBrokerageFeeType(e.target.value as any)}>
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$ por Saca/Caixa)</option>
                  </select>
                </label>
                <label>Valor da Taxa
                  <NumericFormat
                    value={brokerageFeeValue || ''}
                    prefix={brokerageFeeType === 'fixed' ? 'R$ ' : ''}
                    suffix={brokerageFeeType === 'percentage' ? '%' : ''}
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                    onValueChange={(values) => {
                      setBrokerageFeeValue(values.floatValue || 0);
                    }}
                    placeholder={brokerageFeeType === 'fixed' ? 'R$ 0,00' : '0,00%'}
                    required
                  />
                </label>
              </div>
            </section>
          )}
        </div>

        <aside className="stack sidebar-calculation">
          <div className="panel form-section calculation-summary-panel">
            <h2>Resumo da Venda</h2>
            {calculation ? (
              <dl>
                <dt>Total de volumes</dt><dd>{calculation.totalBags}</dd>
                <dt>Total em kg</dt><dd>{formatKg(calculation.totalKg)}</dd>
                <dt>{saleType === 'compra_venda' ? 'Valor total da Venda' : 'Total Particular'}</dt>
                <dd>{money(calculation.totalParticularAmount)}</dd>
                {saleType === 'compra_venda' && (
                  <>
                    <dt>Custo total de Compra</dt>
                    <dd>{money(calculation.totalCostAmount ?? 0)}</dd>
                    <dt>Lucro Bruto estimado</dt>
                    <dd style={{ fontWeight: 'bold', color: '#16a34a' }}>
                      {money((calculation.totalParticularAmount ?? 0) - (calculation.totalCostAmount ?? 0))}
                    </dd>
                  </>
                )}
                <dt>FUNRURAL (1,63%)</dt><dd>{money(calculation.funruralRetentionAmount)}</dd>
                <dt style={{ paddingLeft: '1.2rem', color: '#6b7280', fontSize: '0.85em' }}>Previdência Social (1,30%)</dt>
                <dd style={{ color: '#6b7280', fontSize: '0.85em' }}>{money(calculation.funruralSocialSecurityAmount)}</dd>
                <dt style={{ paddingLeft: '1.2rem', color: '#6b7280', fontSize: '0.85em' }}>RAT (0,10%)</dt>
                <dd style={{ color: '#6b7280', fontSize: '0.85em' }}>{money(calculation.funruralRatAmount)}</dd>
                <dt style={{ paddingLeft: '1.2rem', color: '#6b7280', fontSize: '0.85em' }}>SENAR (0,23%)</dt>
                <dd style={{ color: '#6b7280', fontSize: '0.85em' }}>{money(calculation.funruralSenarAmount)}</dd>
                <dt className="total-highlight">Total a Receber</dt>
                <dd className="total-highlight">{money(calculation.totalReceivableAmount)}</dd>
              </dl>
            ) : <p className="empty">Informe os valores para calcular.</p>}
          </div>

          {calculation && (
            <>
              {saleType === 'intermediacao' && (
                <div className="payout-highlight-box">
                  <span className="payout-label">Comissão Estimada</span>
                  <span className="payout-value">{money(calculation.brokerageAmount ?? 0)}</span>
                </div>
              )}

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
          )}
          <button className="primary-action full" type="submit">Salvar alterações</button>
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
