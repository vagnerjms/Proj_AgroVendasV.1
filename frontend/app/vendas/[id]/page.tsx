'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, apiDelete, authFetch, apiBaseUrl } from '../../../lib/api';

type SaleItem = {
  productId?: { name?: string };
  quantityBags: number;
  bagWeightKg: number;
  quantityKg: number;
  pricePerBag: number;
  lineTotal: number;
  costPerBag?: number;
  lineCostTotal?: number;
};

type SalesOrder = {
  _id: string;
  orderNumber: string;
  saleType: string;
  status: string;
  date: string;
  destinationCity?: string;
  destinationState?: string;
  paymentType?: string;
  termDays?: number;
  dueDate?: string;
  notes?: string;
  items: SaleItem[];
  totalBags: number;
  totalKg: number;
  totalParticularAmount: number;
  totalCostAmount?: number;
  funruralRetentionAmount: number;
  funruralSocialSecurityAmount: number;
  funruralRatAmount: number;
  funruralSenarAmount: number;
  totalReceivableAmount: number;
  producerNetAmount?: number;
  customerId?: { name?: string; city?: string; state?: string };
  producerId?: { name?: string; city?: string; state?: string };
  attachments?: string[];
  orderEvidenceAttachments?: string[];
  fiscalDocuments?: Array<{ number?: string; accessKey?: string; amount?: number; totalWeightKg?: number; unitPrice?: number; extractionMethod?: string; extractionConfidence?: number; extractionError?: string }>;
  fiscalDocumentNumber?: string;
  fiscalDocumentAmount?: number;
  fiscalWeightKg?: number;
  fiscalUnitPrice?: number;
  fiscalTotalAmount?: number;
  fiscalBoxQuantity?: number;
  fiscalBoxQuote?: number;
  fiscalValueSource?: string;
};

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!window.confirm('Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita e irá cancelar os lançamentos financeiros correspondentes.')) {
      return;
    }
    try {
      await apiDelete(`/sales-orders/${params.id}`);
      router.push('/vendas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir venda.');
    }
  }

  async function downloadFile(docId: string, filename: string) {
    try {
      const response = await authFetch(`/sales-orders/${docId}/files/${filename}`);
      if (!response.ok) throw new Error('Erro ao baixar arquivo');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('Não foi possível baixar o arquivo.');
    }
  }

  async function deleteFile(docId: string, filename: string) {
    if (!window.confirm('Tem certeza que deseja excluir este arquivo?')) return;
    try {
      const response = await authFetch(`/sales-orders/${docId}/files/${filename}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir');
      setOrder((prev) => prev ? { ...prev, attachments: prev.attachments?.filter((f) => f !== filename) } : prev);
    } catch (err) {
      alert('Não foi possível excluir o arquivo.');
    }
  }

  async function downloadEvidence(docId: string, filename: string) {
    const response = await authFetch(`/sales-orders/${docId}/evidence/${filename}`);
    if (!response.ok) return alert('Não foi possível baixar a evidência.');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  async function deleteEvidence(docId: string, filename: string) {
    if (!window.confirm('Excluir a evidência da comanda?')) return;
    const response = await authFetch(`/sales-orders/${docId}/evidence/${filename}`, { method: 'DELETE' });
    if (!response.ok) return alert('Não foi possível excluir a evidência.');
    setOrder((prev) => prev ? { ...prev, orderEvidenceAttachments: prev.orderEvidenceAttachments?.filter((file) => file !== filename) } : prev);
  }

  useEffect(() => {
    if (!params.id) {
      return;
    }
    apiGet<SalesOrder>(`/sales-orders/${params.id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar venda.'));
  }, [params.id]);

  if (error) {
    return (
      <main className="shell">
        <p><Link href="/vendas">Voltar</Link></p>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="shell">
        <p><Link href="/vendas">Voltar</Link></p>
        <p className="empty">Carregando venda...</p>
      </main>
    );
  }

  const isResale = order.saleType === 'compra_venda';
  const fiscalWeight = order.fiscalWeightKg;
  const fiscalUnitPrice = order.fiscalUnitPrice;
  const fiscalTotal = order.fiscalTotalAmount ?? order.fiscalDocumentAmount;
  const fiscalBoxes = fiscalWeight !== undefined ? fiscalWeight / 29 : undefined;
  const fiscalQuote = fiscalWeight !== undefined && fiscalUnitPrice !== undefined
    ? fiscalWeight * fiscalUnitPrice
    : order.fiscalBoxQuote;
  const hasFiscalData = Boolean(order.fiscalDocuments?.length || order.fiscalValueSource === 'fiscal_document' || order.fiscalDocumentNumber || fiscalTotal !== undefined);

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/vendas">Vendas</Link></p>
          <h1>{isResale ? 'Compra e Venda' : 'Venda Particular'}: {order.orderNumber}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className="status-pill">{statusLabel(order.status)}</span>
          {order.status !== 'cancelled' && (
            <>
              <Link className="link-action compact-action" href={`/vendas/${order._id}/edit`} style={{ cursor: 'pointer' }}>
                Editar Venda
              </Link>
              <button className="link-action compact-action" style={{ borderColor: '#e53e3e', color: '#e53e3e', cursor: 'pointer' }} type="button" onClick={handleDelete}>
                Excluir Venda
              </button>
            </>
          )}
          {order.status === 'confirmed' && (
            <a 
              className="primary-action compact-action" 
              href={`http://localhost:3001/sales-orders/${order._id}/contract`} 
              target="_blank" 
              rel="noreferrer"
            >
              Baixar Contrato PDF
            </a>
          )}
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Peso líquido NF</span>
          <strong>{fiscalWeight !== undefined ? formatKg(fiscalWeight) : '-'}</strong>
        </article>
        <article className="summary-card">
          <span>{isResale ? 'Total da Venda' : 'Total Particular'}</span>
          <strong>{fiscalTotal !== undefined ? money(fiscalTotal) : '-'}</strong>
        </article>
        {isResale && (
          <article className="summary-card">
            <span>Custo de Compra</span>
            <strong>{money(order.totalCostAmount ?? 0)}</strong>
          </article>
        )}
        <article className="summary-card">
          <span>Total a Receber</span>
          <strong>{fiscalTotal !== undefined ? money(fiscalTotal) : '-'}</strong>
        </article>
      </section>

      {hasFiscalData && (
        <section className="panel form-section" style={{ marginBottom: '1.5rem' }}>
          <h2>Dados oficiais da NF (somente leitura)</h2>
          {order.fiscalDocuments.map((doc, index) => (
            <dl key={`${doc.number || 'nf'}-${index}`}>
              <dt>Pedido</dt><dd>{order.orderNumber}</dd>
              <dt>Número da NF</dt><dd>{doc.number || '-'}</dd>
              <dt>Chave de acesso</dt><dd>{doc.accessKey || '-'}</dd>
              <dt>Peso total</dt><dd>{doc.totalWeightKg?.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) || '-'} kg</dd>
              <dt>Valor unitário</dt><dd>{doc.unitPrice !== undefined ? money(doc.unitPrice) : '-'}</dd>
              <dt>Valor total / líquido</dt><dd>{doc.amount !== undefined ? money(doc.amount) : '-'}</dd>
              <dt>Extração</dt><dd>{doc.extractionMethod || '-'}{doc.extractionConfidence !== undefined ? ` (${Math.round(doc.extractionConfidence * 100)}%)` : ''}</dd>
              {doc.extractionError && <><dt>Erro de extração</dt><dd className="error-message">{doc.extractionError}</dd></>}
            </dl>
          ))}
          {(!order.fiscalDocuments || order.fiscalDocuments.length === 0) && (
            <dl>
              <dt>Pedido</dt><dd>{order.orderNumber}</dd>
              <dt>Número da NF</dt><dd>{order.fiscalDocumentNumber || '-'}</dd>
              <dt>Peso total</dt><dd>{fiscalWeight !== undefined ? formatKg(fiscalWeight) : '-'}</dd>
              <dt>Valor unitário</dt><dd>{fiscalUnitPrice !== undefined ? money(fiscalUnitPrice) : '-'}</dd>
              <dt>Valor total / líquido</dt><dd>{fiscalTotal !== undefined ? money(fiscalTotal) : '-'}</dd>
            </dl>
          )}
          <p style={{ marginTop: '1rem', color: '#526052' }}>Caixas derivadas: {(order.fiscalBoxQuantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Cotação da caixa: {money(order.fiscalBoxQuote || 0)}.</p>
        </section>
      )}

      <section className="detail-grid">
        <article className="panel form-section">
          <h2>Dados Gerais</h2>
          <dl>
            <dt>Tipo de Operação</dt><dd>{isResale ? 'Compra e Venda (Revenda)' : 'Particular (Intermediação)'}</dd>
            <dt>Data</dt><dd>{formatDate(order.date)}</dd>
            <dt>Produto</dt><dd>{order.items?.length === 1 ? order.items[0].productId?.name : (order.items && order.items.length > 1 ? 'Vários' : '-')}</dd>
            <dt>Produtor</dt><dd>{order.producerId?.name ?? '-'}</dd>
            <dt>Cliente</dt><dd>{order.customerId?.name ?? '-'}</dd>
            <dt>Destino</dt><dd>{[order.destinationCity, order.destinationState].filter(Boolean).join('/') || '-'}</dd>
          </dl>
        </article>

        <article className="panel form-section">
          <h2>Pagamento</h2>
          <dl>
            <dt>Condição</dt><dd>{order.paymentType === 'cash' ? 'À vista' : `${order.termDays ?? 0} dias`}</dd>
            <dt>Vencimento</dt><dd>{formatDate(order.dueDate)}</dd>
            <dt>Status</dt><dd>{statusLabel(order.status)}</dd>
          </dl>
        </article>

        {(order.notes || (order.attachments && order.attachments.length > 0) || (order.orderEvidenceAttachments && order.orderEvidenceAttachments.length > 0)) && (
          <article className="panel form-section" style={{ gridColumn: '1 / -1' }}>
            <h2>Observações e Anexos</h2>
            <div style={{ marginTop: '10px' }}>
              {order.notes && <p style={{ whiteSpace: 'pre-wrap', marginBottom: '15px' }}>{order.notes}</p>}
              
              {order.attachments && order.attachments.length > 0 && (
                <div>
                  <strong>Anexos:</strong>
                  <ul style={{ listStyleType: 'none', padding: 0, marginTop: '8px' }}>
                    {order.attachments.map((file, i) => (
                      <li key={i} style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                          type="button" 
                          onClick={() => downloadFile(order._id, file)}
                          style={{ background: 'none', border: 'none', color: '#16a34a', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '14px' }}
                        >
                          {file.split('-').slice(1).join('-') || file}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFile(order._id, file)}
                          style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', padding: '2px', fontSize: '14px', display: 'flex', alignItems: 'center' }}
                          title="Excluir arquivo"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {order.orderEvidenceAttachments && order.orderEvidenceAttachments.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Pedidos/comandas (evidência da venda):</strong>
                  <ul style={{ listStyleType: 'none', padding: 0, marginTop: '8px' }}>
                    {order.orderEvidenceAttachments.map((file) => (
                      <li key={file} style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button type="button" onClick={() => downloadEvidence(order._id, file)} style={{ background: 'none', border: 'none', color: '#256029', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                          {file.split('-').slice(1).join('-') || file}
                        </button>
                        <button type="button" onClick={() => deleteEvidence(order._id, file)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer' }}>Excluir</button>
                      </li>
                    ))}
                  </ul>
                  <p style={{ color: '#667085', fontSize: '13px' }}>Vinculado ao pedido {order.orderNumber}; não altera os dados da NF nem os cálculos.</p>
                </div>
              )}
            </div>
          </article>
        )}
      </section>

      <section className="panel form-section">
        <h2>Itens da Venda</h2>
        <div className="items-table">
          <div className={`items-row items-head ${isResale ? 'compra-venda-detail-row' : 'detail-items-row'}`}>
            <span>Produto</span>
            <span>Qtd</span>
            <span>Peso Unit.</span>
            <span>Total kg</span>
            {isResale && <span>Custo Unit.</span>}
            <span>Valor Unit.</span>
            <span>Total</span>
          </div>
          {order.items.map((item, index) => {
            const getUnitSuffix = (product: any) => {
              if (!product) return 'sc';
              const unit = product.defaultUnit || 'saco';
              if (unit === 'caixa') return 'cx';
              if (unit === 'saco') return 'sc';
              if (unit === 'saca') return 'sc';
              if (unit === 'pacote') return 'pct';
              if (unit === 'kg') return 'kg';
              if (unit === 'unidade') return 'un';
              if (unit === 'tonelada') return 't';
              return unit;
            };

            const fiscalItem = hasFiscalData && item.productId?.name?.toLowerCase().includes('cenoura');
            return (
              <div className={`items-row ${isResale ? 'compra-venda-detail-row' : 'detail-items-row'}`} key={index}>
                <strong>{item.productId?.name ?? '-'}</strong>
                <span>{fiscalItem && fiscalBoxes !== undefined ? `${fiscalBoxes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cx` : `${item.quantityBags} ${getUnitSuffix(item.productId)}`}</span>
                <span>{fiscalItem ? '29 kg' : formatKg(item.bagWeightKg)}</span>
                <span>{fiscalItem && fiscalWeight !== undefined ? formatKg(fiscalWeight) : formatKg(item.quantityKg)}</span>
                {isResale && <span>{money(item.costPerBag ?? 0)}</span>}
                <span>{fiscalItem && fiscalUnitPrice !== undefined ? money(fiscalUnitPrice) : money(item.pricePerBag)}</span>
                <span>{fiscalItem && fiscalTotal !== undefined ? money(fiscalTotal) : money(item.lineTotal)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel form-section">
        <h2>Resumo Financeiro</h2>
        <dl>
          <dt>Total em kg</dt><dd>{fiscalWeight !== undefined ? formatKg(fiscalWeight) : '-'}</dd>
          <dt>{isResale ? 'Valor total da Venda' : 'Total Particular'}</dt>
          <dd>{fiscalTotal !== undefined ? money(fiscalTotal) : '-'}</dd>
          {isResale && (
            <>
              <dt>Custo total de Compra</dt>
              <dd>{money(order.totalCostAmount ?? 0)}</dd>
              <dt>Lucro Bruto estimado</dt>
              <dd>{money((order.totalParticularAmount ?? 0) - (order.totalCostAmount ?? 0))}</dd>
            </>
          )}
          <dt>FUNRURAL 1,63%</dt><dd>{fiscalTotal !== undefined ? money(fiscalTotal * 0.0163) : '-'}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>Previdência Social 1,30%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralSocialSecurityAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>RAT 0,10%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralRatAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>SENAR 0,23%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralSenarAmount ?? 0)}</dd>
          <dt>Total a Receber</dt><dd>{fiscalTotal !== undefined ? money(fiscalTotal) : '-'}</dd>
          {isResale && (
            <>
              <dt>Líquido ao Produtor</dt>
              <dd>{money(order.producerNetAmount ?? 0)}</dd>
            </>
          )}
        </dl>
      </section>
    </main>
  );
}

function money(value?: number) {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
}

function formatKg(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
  };
  return labels[status] ?? status;
}

