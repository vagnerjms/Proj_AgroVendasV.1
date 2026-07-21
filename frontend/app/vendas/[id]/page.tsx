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
            <button className="link-action compact-action" style={{ borderColor: '#e53e3e', color: '#e53e3e', cursor: 'pointer' }} type="button" onClick={handleDelete}>
              Excluir Venda
            </button>
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
          <span>Total de volumes</span>
          <strong>{order.totalBags ?? 0}</strong>
        </article>
        <article className="summary-card">
          <span>{isResale ? 'Total da Venda' : 'Total Particular'}</span>
          <strong>{money(order.totalParticularAmount ?? 0)}</strong>
        </article>
        {isResale && (
          <article className="summary-card">
            <span>Custo de Compra</span>
            <strong>{money(order.totalCostAmount ?? 0)}</strong>
          </article>
        )}
        <article className="summary-card">
          <span>Total a Receber</span>
          <strong>{money(order.totalReceivableAmount ?? 0)}</strong>
        </article>
      </section>

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

        {(order.notes || (order.attachments && order.attachments.length > 0)) && (
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

            return (
              <div className={`items-row ${isResale ? 'compra-venda-detail-row' : 'detail-items-row'}`} key={index}>
                <strong>{item.productId?.name ?? '-'}</strong>
                <span>{item.quantityBags} {getUnitSuffix(item.productId)}</span>
                <span>{formatKg(item.bagWeightKg)}</span>
                <span>{formatKg(item.quantityKg)}</span>
                {isResale && <span>{money(item.costPerBag ?? 0)}</span>}
                <span>{money(item.pricePerBag)}</span>
                <span>{money(item.lineTotal)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel form-section">
        <h2>Resumo Financeiro</h2>
        <dl>
          <dt>Total em kg</dt><dd>{formatKg(order.totalKg ?? 0)}</dd>
          <dt>{isResale ? 'Valor total da Venda' : 'Total Particular'}</dt>
          <dd>{money(order.totalParticularAmount ?? 0)}</dd>
          {isResale && (
            <>
              <dt>Custo total de Compra</dt>
              <dd>{money(order.totalCostAmount ?? 0)}</dd>
              <dt>Lucro Bruto estimado</dt>
              <dd>{money((order.totalParticularAmount ?? 0) - (order.totalCostAmount ?? 0))}</dd>
            </>
          )}
          <dt>FUNRURAL 1,63%</dt><dd>{money(order.funruralRetentionAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>Previdência Social 1,30%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralSocialSecurityAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>RAT 0,10%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralRatAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>SENAR 0,23%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralSenarAmount ?? 0)}</dd>
          <dt>Total a Receber</dt><dd>{money(order.totalReceivableAmount ?? 0)}</dd>
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

