'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, apiDelete } from '../../../lib/api';

type PurchaseItem = {
  productId?: { name?: string };
  quantityBags: number;
  bagWeightKg: number;
  quantityKg: number;
  costPerBag: number;
  lineTotal: number;
};

type PurchaseOrder = {
  _id: string;
  orderNumber: string;
  status: string;
  date: string;
  originLocation?: string;
  paymentType?: string;
  termDays?: number;
  dueDate?: string;
  notes?: string;
  items: PurchaseItem[];
  totalBags: number;
  totalKg: number;
  totalAmount: number;
  funruralRetentionAmount: number;
  funruralSocialSecurityAmount: number;
  funruralRatAmount: number;
  funruralSenarAmount: number;
  producerNetAmount: number;
  producerId?: { name?: string; city?: string; state?: string };
};

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!window.confirm('Tem certeza que deseja excluir esta compra? Esta ação não pode ser desfeita e irá cancelar os lançamentos financeiros correspondentes.')) {
      return;
    }
    try {
      await apiDelete(`/purchase-orders/${params.id}`);
      router.push('/compras');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir compra.');
    }
  }

  useEffect(() => {
    if (!params.id) {
      return;
    }
    apiGet<PurchaseOrder>(`/purchase-orders/${params.id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar compra.'));
  }, [params.id]);

  if (error) {
    return (
      <main className="shell">
        <p><Link href="/compras">Voltar</Link></p>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="shell">
        <p><Link href="/compras">Voltar</Link></p>
        <p className="empty">Carregando compra...</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/compras">Compras</Link></p>
          <h1>Entrada: {order.orderNumber}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className="status-pill">{statusLabel(order.status)}</span>
          {order.status !== 'cancelled' && (
            <button className="link-action compact-action" style={{ borderColor: '#e53e3e', color: '#e53e3e', cursor: 'pointer' }} type="button" onClick={handleDelete}>
              Excluir Compra
            </button>
          )}
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Total de sacos</span>
          <strong>{order.totalBags ?? 0}</strong>
        </article>
        <article className="summary-card">
          <span>Custo Bruto</span>
          <strong>{money(order.totalAmount ?? 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Líquido ao Produtor</span>
          <strong>{money(order.producerNetAmount ?? 0)}</strong>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel form-section">
          <h2>Dados Gerais</h2>
          <dl>
            <dt>Data</dt><dd>{formatDate(order.date)}</dd>
            <dt>Produto</dt><dd>{order.items?.length === 1 ? order.items[0].productId?.name : (order.items && order.items.length > 1 ? 'Vários' : '-')}</dd>
            <dt>Produtor</dt><dd>{order.producerId?.name ?? '-'}</dd>
            <dt>Origem</dt><dd>{order.originLocation || '-'}</dd>
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
      </section>

      <section className="panel form-section">
        <h2>Itens da Compra</h2>
        <div className="items-table">
          <div className="items-row items-head detail-items-row">
            <span>Produto</span>
            <span>Sacos</span>
            <span>Kg por saca</span>
            <span>Total kg</span>
            <span>Custo por saca</span>
            <span>Total</span>
          </div>
          {order.items.map((item, index) => (
            <div className="items-row detail-items-row" key={index}>
              <strong>{item.productId?.name ?? '-'}</strong>
              <span>{item.quantityBags}</span>
              <span>{formatKg(item.bagWeightKg)}</span>
              <span>{formatKg(item.quantityKg)}</span>
              <span>{money(item.costPerBag)}</span>
              <span>{money(item.lineTotal)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel form-section">
        <h2>Resumo Financeiro</h2>
        <dl>
          <dt>Total em kg</dt><dd>{formatKg(order.totalKg ?? 0)}</dd>
          <dt>Custo Bruto</dt>
          <dd>{money(order.totalAmount ?? 0)}</dd>
          <dt>FUNRURAL 1,50%</dt><dd>{money(order.funruralRetentionAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>Previdência Social 1,20%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralSocialSecurityAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>RAT 0,10%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralRatAmount ?? 0)}</dd>
          <dt style={{ paddingLeft: '1.5rem', color: '#777', fontSize: '0.9em' }}>SENAR 0,20%</dt><dd style={{ color: '#777', fontSize: '0.9em' }}>{money(order.funruralSenarAmount ?? 0)}</dd>
          <dt>Líquido a Pagar ao Produtor</dt><dd>{money(order.producerNetAmount ?? 0)}</dd>
        </dl>
      </section>
    </main>
  );
}

function money(value: number) {
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
