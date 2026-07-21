'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { toast } from 'react-toastify';
import { apiGet, apiPatch, apiPost, authFetch, apiDelete, apiBaseUrl } from '../../lib/api';

type Entity = { _id?: string; name?: string; documentType?: string };

type SalesOrder = {
  _id: string;
  orderNumber: string;
  date: string;
  fiscalStatus: string;
  totalReceivableAmount: number;
  totalParticularAmount: number;
  customerId?: Entity;
  producerId?: Entity;
  funruralRetentionAmount?: number;
};

type PurchaseOrder = {
  _id: string;
  orderNumber: string;
  date: string;
  fiscalStatus: string;
  totalAmount: number;
  producerId?: Entity;
  funruralRetentionAmount?: number;
};

type FiscalDocument = {
  _id: string;
  salesOrderId?: string | SalesOrder;
  purchaseOrderId?: string | PurchaseOrder;
  orderNumber: string;
  accessKey?: string;
  number?: string;
  series?: string;
  issuedAt?: string;
  issuer?: string;
  recipient?: string;
  amount?: number;
  status: string;
  notes?: string;
  files?: Array<{
    _id: string;
    originalName: string;
    mimeType: string;
  }>;
};

type FiscalRow = {
  type: 'sale' | 'purchase';
  order: SalesOrder | PurchaseOrder;
  fiscal?: FiscalDocument;
};

const emptyFilters = {
  orderNumber: '',
  customer: '',
  producer: '',
  number: '',
  accessKey: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

const emptyForm = {
  number: '',
  series: '',
  accessKey: '',
  issuedAt: new Date().toISOString().slice(0, 10),
  issuer: '',
  recipient: '',
  amount: 0,
  status: 'issued',
  notes: '',
};

type FiscalSummary = {
  purchasesFunrural: number;
  salesFunruralRetainedByCustomers: number;
  totalLiability: number;
};

const emptyFiscalSummary: FiscalSummary = {
  purchasesFunrural: 0,
  salesFunruralRetainedByCustomers: 0,
  totalLiability: 0,
};

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedRow, setSelectedRow] = useState<FiscalRow | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FiscalDocument | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    void loadData();
    const orderNumber = new URLSearchParams(window.location.search).get('orderNumber');
    if (orderNumber) {
      setFilters((current) => ({ ...current, orderNumber }));
    }
  }, []);

  async function loadData() {
    const [salesResponse, purchasesResponse, docsResponse] = await Promise.all([
      apiGet<SalesOrder[]>('/sales-orders').catch(() => []),
      apiGet<PurchaseOrder[]>('/purchase-orders').catch(() => []),
      apiGet<FiscalDocument[]>('/fiscal-documents').catch(() => []),
    ]);
    setSales(salesResponse);
    setPurchases(purchasesResponse);
    setDocuments(docsResponse);
  }

  const computedSummary = useMemo<FiscalSummary>(() => {
    const filteredSales = sales.filter((o) => {
      const orderDate = o.date?.slice(0, 10) ?? '';
      const matchesDateFrom = !filters.dateFrom || orderDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || orderDate <= filters.dateTo;
      const matchesProducer = !filters.producer || o.producerId?.name?.toLowerCase().includes(filters.producer.toLowerCase());
      const matchesCustomer = !filters.customer || o.customerId?.name?.toLowerCase().includes(filters.customer.toLowerCase());
      return matchesDateFrom && matchesDateTo && matchesProducer && matchesCustomer;
    });

    const filteredPurchases = purchases.filter((o) => {
      const orderDate = o.date?.slice(0, 10) ?? '';
      const matchesDateFrom = !filters.dateFrom || orderDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || orderDate <= filters.dateTo;
      const matchesProducer = !filters.producer || o.producerId?.name?.toLowerCase().includes(filters.producer.toLowerCase());
      return matchesDateFrom && matchesDateTo && matchesProducer;
    });

    const purchasesFunrural = filteredPurchases.reduce((sum, order) => sum + (order.funruralRetentionAmount ?? 0), 0);
    
    const salesFunruralLiability = filteredSales
      .filter((order) => order.customerId?.documentType !== 'cnpj')
      .reduce((sum, order: any) => sum + (order.funruralRetentionAmount ?? 0), 0);

    const salesFunruralRetainedByCustomers = filteredSales
      .filter((order) => order.customerId?.documentType === 'cnpj')
      .reduce((sum, order: any) => sum + (order.funruralRetentionAmount ?? 0), 0);

    return {
      purchasesFunrural: purchasesFunrural + salesFunruralLiability,
      salesFunruralRetainedByCustomers,
      totalLiability: purchasesFunrural + salesFunruralLiability,
    };
  }, [sales, purchases, filters]);

  const rows = useMemo<FiscalRow[]>(() => {
    const docsByOrder = new Map(documents.map((doc) => [doc.orderNumber, doc]));
    const currentOrders = activeTab === 'sales' ? sales : purchases;
    
    return currentOrders
      .map((order) => ({ type: (activeTab === 'sales' ? 'sale' : 'purchase') as 'sale' | 'purchase', order, fiscal: docsByOrder.get(order.orderNumber) }))
      .filter(({ order, fiscal }) => {
        const orderDate = order.date?.slice(0, 10) ?? '';
        const isSale = activeTab === 'sales';
        const sale = isSale ? (order as SalesOrder) : undefined;
        const purchase = !isSale ? (order as PurchaseOrder) : undefined;

        return (
          matches(order.orderNumber, filters.orderNumber) &&
          matches(sale?.customerId?.name, filters.customer) &&
          matches(sale?.producerId?.name ?? purchase?.producerId?.name, filters.producer) &&
          matches(fiscal?.number, filters.number) &&
          matches(fiscal?.accessKey, filters.accessKey) &&
          (!filters.status || (fiscal?.status ?? order.fiscalStatus) === filters.status) &&
          (!filters.dateFrom || orderDate >= filters.dateFrom) &&
          (!filters.dateTo || orderDate <= filters.dateTo)
        );
      });
  }, [sales, purchases, documents, filters, activeTab]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return rows.slice(start, start + limit);
  }, [rows, page]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function openLinkForm(row: FiscalRow) {
    setSelectedRow(row);
    setSelectedDocument(row.fiscal ?? null);
    
    const amount = row.type === 'sale' 
      ? (row.order as SalesOrder).totalParticularAmount 
      : (row.order as PurchaseOrder).totalAmount;
      
    const recipient = row.type === 'sale'
      ? (row.order as SalesOrder).customerId?.name
      : (row.order as PurchaseOrder).producerId?.name;

    setForm(
      row.fiscal
        ? {
            number: row.fiscal.number ?? '',
            series: row.fiscal.series ?? '',
            accessKey: row.fiscal.accessKey ?? '',
            issuedAt: row.fiscal.issuedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
            issuer: row.fiscal.issuer ?? '',
            recipient: row.fiscal.recipient ?? '',
            amount: row.fiscal.amount ?? amount ?? 0,
            status: row.fiscal.status ?? 'issued',
            notes: row.fiscal.notes ?? '',
          }
        : {
            ...emptyForm,
            amount: amount ?? 0,
            recipient: recipient ?? '',
          },
    );
    setFile(null);
    setMessage('');
  }

  async function submitFiscal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRow) {
      return;
    }

    const missingFields = [];
    if (!form.number) missingFields.push('Número da NF');
    if (!form.accessKey) missingFields.push('Chave de acesso');
    if (!form.issuer) missingFields.push('Emitente');
    if (!form.recipient) missingFields.push('Destinatário');

    if (missingFields.length > 0) {
      toast.warning(`Preencha os campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    setMessage('');
    try {
      const payload: any = {
        salesOrderId: selectedRow.type === 'sale' ? selectedRow.order._id : undefined,
        purchaseOrderId: selectedRow.type === 'purchase' ? selectedRow.order._id : undefined,
        amount: Number(form.amount),
        status: form.status,
        issuedAt: form.issuedAt,
      };
      
      if (form.number) payload.number = form.number;
      if (form.series) payload.series = form.series;
      if (form.accessKey) payload.accessKey = form.accessKey;
      if (form.issuer) payload.issuer = form.issuer;
      if (form.recipient) payload.recipient = form.recipient;
      if (form.notes) payload.notes = form.notes;

      const fiscal = selectedDocument
        ? await apiPatch<FiscalDocument>(`/fiscal-documents/${selectedDocument._id}`, payload)
        : await apiPost<FiscalDocument>('/fiscal-documents', payload);

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await authFetch(`/fiscal-documents/${fiscal._id}/files`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
      }

      toast.success(`Nota vinculada a ${selectedRow.order.orderNumber}.`);
      setSelectedRow(null);
      setSelectedDocument(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao vincular nota fiscal.');
    }
  }

  async function deleteFiscal() {
    if (!selectedDocument || !confirm('Deseja realmente excluir este vínculo fiscal e apagar os arquivos?')) {
      return;
    }
    
    try {
      await apiDelete(`/fiscal-documents/${selectedDocument._id}`);
      toast.success('Vínculo fiscal e arquivos apagados.');
      setSelectedRow(null);
      setSelectedDocument(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao apagar vínculo.');
    }
  }

  async function downloadFile(docId: string, fileId: string, fileName: string) {
    try {
      const response = await authFetch(`/fiscal-documents/${docId}/files/${fileId}/download`);
      if (!response.ok) throw new Error('Erro ao baixar arquivo');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Erro ao realizar download do arquivo.');
    }
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link></p>
          <h1>Fiscal</h1>
        </div>
        <div className="tabs-nav" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button 
            type="button" 
            onClick={() => { setActiveTab('sales'); setPage(1); }}
            className={activeTab === 'sales' ? 'active' : ''}
          >
            Vendas
          </button>
          <button 
            type="button" 
            onClick={() => { setActiveTab('purchases'); setPage(1); }}
            className={activeTab === 'purchases' ? 'active' : ''}
          >
            Compras
          </button>
        </div>
      </section>

      <section className="summary-grid dashboard-grid" aria-label="Resumo Tributário">
        <div className="summary-card dashboard-card">
          <span>
            Provisão a Pagar (DARF){' '}
            <span title="Sua dívida com a Receita Federal. Nasce das suas COMPRAS: você pagou mais barato ao produtor e reteve esse valor, que agora deve ser pago ao governo." style={{cursor: 'help', color: '#888', fontWeight: 'bold'}}>ⓘ</span>
          </span>
          <strong>{money(computedSummary.totalLiability)}</strong>
        </div>
        <div className="summary-card dashboard-card">
          <span>
            Retido por Clientes{' '}
            <span title="Imposto recolhido pelos seus clientes. Nasce das suas VENDAS: o supermercado já descontou esse valor do seu pagamento para acertar com a Receita por você." style={{cursor: 'help', color: '#888', fontWeight: 'bold'}}>ⓘ</span>
          </span>
          <strong>{money(computedSummary.salesFunruralRetainedByCustomers)}</strong>
        </div>
      </section>

      <section className="panel form-section">
        <h2>Filtros</h2>
        <div className="filters-grid fiscal-filters-grid">
          <label>Número da venda
            <input value={filters.orderNumber} onChange={(event) => updateFilter('orderNumber', event.target.value)} />
          </label>
          <label>Cliente
            <input value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} />
          </label>
          <label>Produtor
            <input value={filters.producer} onChange={(event) => updateFilter('producer', event.target.value)} />
          </label>
          <label>Número da NF
            <input value={filters.number} onChange={(event) => updateFilter('number', event.target.value)} />
          </label>
          <label>Chave de acesso
            <input value={filters.accessKey} onChange={(event) => updateFilter('accessKey', event.target.value)} />
          </label>
          <label>Status fiscal
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="issued">Emitida</option>
              <option value="divergent">Divergente</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label>De
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>Até
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="table">
          <div className="table-row fiscal-table-head">
            <span>{activeTab === 'sales' ? 'Venda' : 'Compra'}</span>
            {activeTab === 'sales' && <span>Cliente</span>}
            <span>Produtor</span>
            <span>Data</span>
            <span>Valor OP</span>
            <span>Número NF</span>
            <span>Valor NF</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {paginatedRows.map((row) => {
            const { order, fiscal, type } = row;
            return (
            <div className="table-row fiscal-table-row" key={order._id}>
              <span>{order.orderNumber}</span>
              {type === 'sale' && <span>{(order as SalesOrder).customerId?.name ?? '-'}</span>}
              <span>{order.producerId?.name ?? '-'}</span>
              <span>{formatDate(order.date)}</span>
              <span>{money(type === 'sale' ? (order as SalesOrder).totalParticularAmount ?? 0 : (order as PurchaseOrder).totalAmount ?? 0)}</span>
              <span>{fiscal?.number ?? '-'}</span>
              <span>{fiscal?.amount !== undefined ? money(fiscal.amount) : '-'}</span>
              <span>{fiscalStatusLabel(fiscal?.status ?? order.fiscalStatus)}</span>
              <span>
                <button className="link-action compact-action" type="button" onClick={() => openLinkForm(row)}>
                  {fiscal ? 'Editar Nota' : 'Vincular Nota'}
                </button>
              </span>
            </div>
            );
          })}
          {rows.length === 0 ? <p className="empty">Nenhuma operação encontrada para o filtro fiscal.</p> : null}
          {rows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                Exibindo {paginatedRows.length} de {rows.length} registros (Página {page})
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="link-action compact-action" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Anterior
                </button>
                <button className="link-action compact-action" disabled={page * limit >= rows.length} onClick={() => setPage(p => p + 1)}>
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedRow ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submitFiscal}>
            <div className="modal-header">
              <h2>{selectedDocument ? 'Editar Nota' : 'Vincular Nota'}</h2>
              <button type="button" onClick={() => setSelectedRow(null)}>Fechar</button>
            </div>
            <p className="empty">Operação: <strong>{selectedRow.order.orderNumber}</strong></p>
            <div className="form-grid">
              <label>Número da NF
                <input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} />
              </label>
              <label>Série
                <input value={form.series} onChange={(event) => setForm((current) => ({ ...current, series: event.target.value }))} />
              </label>
              <label className="wide">Chave de acesso
                <input value={form.accessKey} onChange={(event) => setForm((current) => ({ ...current, accessKey: event.target.value }))} />
              </label>
              <label>Data de emissão
                <input type="date" value={form.issuedAt} onChange={(event) => setForm((current) => ({ ...current, issuedAt: event.target.value }))} />
              </label>
              <label>Valor
                <NumericFormat
                  value={form.amount}
                  onValueChange={(values) => setForm((current) => ({ ...current, amount: values.floatValue ?? 0 }))}
                  prefix="R$ "
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                />
              </label>
              <label>Emitente
                <input value={form.issuer} onChange={(event) => setForm((current) => ({ ...current, issuer: event.target.value }))} />
              </label>
              <label>Destinatário
                <input value={form.recipient} onChange={(event) => setForm((current) => ({ ...current, recipient: event.target.value }))} />
              </label>
              <label>Status
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="pending">Pendente</option>
                  <option value="issued">Emitida</option>
                  <option value="divergent">Divergente</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </label>
              <label>Upload PDF/XML/imagem
                <input
                  type="file"
                  accept=".pdf,.xml,.png,.jpg,.jpeg,application/pdf,application/xml,text/xml,image/png,image/jpeg"
                  onChange={(event) => {
                    const uploadedFile = event.target.files?.[0] ?? null;
                    setFile(uploadedFile);

                    if (uploadedFile && uploadedFile.name.toLowerCase().endsWith('.pdf')) {
                      const reader = new FileReader();
                      reader.onload = async (e) => {
                        try {
                          const arrayBuffer = e.target?.result as ArrayBuffer;
                          
                          // Load PDF.js dynamically via CDN to bypass npm network issues
                          if (!(window as any).pdfjsLib) {
                            await new Promise((resolve, reject) => {
                              const script = document.createElement('script');
                              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                              script.onload = resolve;
                              script.onerror = reject;
                              document.head.appendChild(script);
                            });
                          }
                          
                          const pdfjsLib = (window as any).pdfjsLib;
                          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                          
                          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                          const doc = await loadingTask.promise;
                          const page = await doc.getPage(1);
                          const content = await page.getTextContent();
                          const text = content.items.map((i: any) => i.str).join(' ');
                          
                          // A Chave de Acesso no PDF costuma ter espaços (ex: 1234 5678...). 
                          // Buscamos 44 dígitos que podem estar separados por até 3 espaços.
                          const possibleKeys = text.match(/(?:\d[\s]{0,3}){44}/g);
                          let chNFe = undefined;
                          if (possibleKeys) {
                            for (const pk of possibleKeys) {
                              const clean = pk.replace(/\D/g, '');
                              if (clean.length === 44) {
                                chNFe = clean;
                                break;
                              }
                            }
                          }
                          
                          const numberMatch = text.match(/(?:Nº|N.|NF-e|Número)\s*(\d{1,9})/i);
                          const amountMatches = Array.from(text.matchAll(/(?:VALOR TOTAL|V\. TOTAL|TOTAL DA NOTA|TOTAL DOS PRODUTOS)[\s\S]{0,30}?([\d]{1,3}(?:\.[\d]{3})*,\d{2})/gi));
                          let amount = undefined;
                          if (amountMatches.length > 0) {
                            const values = amountMatches.map((m: any) => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
                            amount = Math.max(...values);
                          } else {
                            const fallback = text.match(/(?:R\$|VALOR)[\s:]*([\d]{1,3}(?:\.[\d]{3})*,\d{2})/i);
                            if (fallback) {
                              amount = parseFloat(fallback[1].replace(/\./g, '').replace(',', '.'));
                            }
                          }

                          // Tentativa de pegar Destinatário (Procurando a tag exata do DANFE)
                          const destMatch = text.match(/(?:NOME\s*[\/\-]?\s*RAZ[ÃA]O\s+SOCIAL|DESTINAT[ÁA]RIO.*?NOME.*?)\s+([A-Z0-9\s&.\-ÇçÃãÕõÂâÊêÎîÔôÛûÁáÉéÍíÓóÚú]{3,80}?)\s+(?:CNPJ|CPF|DATA|ENDEREÇO|BAIRRO|INSCRIÇÃO)/i);
                          let destName = destMatch ? destMatch[1].trim() : undefined;
                          if (destName && destName.length < 3) destName = undefined;

                          // Tentativa de pegar Emitente (Geralmente é a primeira coisa do PDF)
                          const emitMatch = text.match(/^\s*([A-Z0-9\s&.\-ÇçÃãÕõÂâÊêÎîÔôÛûÁáÉéÍíÓóÚú]{5,100}?)\s+(?:DANFE|DOCUMENTO AUXILIAR|CNPJ|RUA|AV|AVENIDA|RODOVIA)/i);
                          let emitName = emitMatch ? emitMatch[1].trim() : undefined;
                          if (emitName && emitName.length < 3) emitName = undefined;

                          const nNF = numberMatch ? numberMatch[1] : undefined;

                          setForm((prev) => ({
                            ...prev,
                            ...(chNFe && { accessKey: chNFe }),
                            ...(nNF && { number: nNF }),
                            ...(amount !== undefined && !isNaN(amount) && { amount: amount }),
                            ...(emitName && { issuer: emitName }),
                            ...(destName && { recipient: destName })
                          }));
                          toast.success('PDF analisado via nuvem! Por favor, confira os dados extraídos. ✨');
                        } catch (err) {
                          console.error(err);
                          toast.error('Erro ao ler os dados do PDF.');
                        }
                      };
                      reader.readAsArrayBuffer(uploadedFile);
                    } else if (uploadedFile && uploadedFile.name.toLowerCase().endsWith('.xml')) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        try {
                          const text = e.target?.result as string;
                          const parser = new DOMParser();
                          const xmlDoc = parser.parseFromString(text, 'text/xml');
                          
                          const getTag = (tag: string) => xmlDoc.getElementsByTagName(tag)[0]?.textContent ?? '';
                          
                          const chNFe = getTag('chNFe') || (xmlDoc.getElementsByTagName('infNFe')[0]?.getAttribute('Id')?.replace('NFe', '') ?? '');
                          const nNF = getTag('nNF');
                          const serie = getTag('serie');
                          const dhEmiRaw = getTag('dhEmi') || getTag('dEmi');
                          const dhEmi = dhEmiRaw ? dhEmiRaw.slice(0, 10) : undefined;
                          
                          const icmsTot = xmlDoc.getElementsByTagName('ICMSTot')[0];
                          const vNF = icmsTot ? icmsTot.getElementsByTagName('vNF')[0]?.textContent : getTag('vNF');
                          
                          const emitNode = xmlDoc.getElementsByTagName('emit')[0];
                          const emitName = emitNode ? emitNode.getElementsByTagName('xNome')[0]?.textContent : '';
                          
                          const destNode = xmlDoc.getElementsByTagName('dest')[0];
                          const destName = destNode ? destNode.getElementsByTagName('xNome')[0]?.textContent : '';
                          
                          setForm((prev) => ({
                            ...prev,
                            ...(chNFe && { accessKey: chNFe }),
                            ...(nNF && { number: nNF }),
                            ...(serie && { series: serie }),
                            ...(dhEmi && { issuedAt: dhEmi }),
                            ...(emitName && { issuer: emitName }),
                            ...(destName && { recipient: destName }),
                            ...(vNF && { amount: Number(vNF) })
                          }));
                          toast.success('Campos preenchidos magicamente pelo XML! ✨');
                        } catch (err) {
                          console.error(err);
                          toast.error('Erro ao ler os dados do XML.');
                        }
                      };
                      reader.readAsText(uploadedFile);
                    }
                  }}
                />
              </label>
              <label className="wide">Observações
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
            
            {selectedDocument && selectedDocument.files && selectedDocument.files.length > 0 && (
              <div className="fiscal-files-list" style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                <h4>Arquivos Anexados</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0' }}>
                  {selectedDocument.files.map(f => (
                    <li key={f._id} style={{ marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => downloadFile(selectedDocument._id, f._id, f.originalName)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#0066cc', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}
                      >
                        📄 {f.originalName}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="primary-action full" type="submit">Salvar vínculo fiscal</button>
              {selectedDocument && (
                <button 
                  className="danger-action full" 
                  type="button" 
                  onClick={deleteFiscal}
                  style={{ background: '#dc3545', color: 'white' }}
                >
                  Excluir Vínculo
                </button>
              )}
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function matches(value: string | undefined, filter: string) {
  return !filter || (value ?? '').toLowerCase().includes(filter.toLowerCase());
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
}

function fiscalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    issued: 'Emitida',
    divergent: 'Divergente',
    cancelled: 'Cancelada',
  };
  return labels[status] ?? status;
}

