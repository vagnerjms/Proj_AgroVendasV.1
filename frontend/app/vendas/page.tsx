'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiDelete } from '../../lib/api';

type SalesOrder = {
  _id: string;
  orderNumber: string;
  date: string;
  status: string;
  totalBags: number;
  totalParticularAmount: number;
  totalReceivableAmount: number;
  customerId?: { name?: string };
  producerId?: { name?: string };
  saleType?: string;
  items?: { productId?: { name?: string } }[];
  fiscalDocumentAmount?: number;
};

const emptyFilters = {
  orderNumber: '',
  customer: '',
  producer: '',
  date: '',
  status: '',
};

export default function SalesListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 400);
    return () => clearTimeout(timer);
  }, [page, filters]);

  function loadOrders() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters.orderNumber && { orderNumber: filters.orderNumber }),
      ...(filters.customer && { customer: filters.customer }),
      ...(filters.producer && { producer: filters.producer }),
      ...(filters.status && { status: filters.status }),
      ...(filters.date && { date: filters.date }),
    });

    apiGet<{ data: SalesOrder[], total: number }>(`/sales-orders?${params.toString()}`)
      .then((res) => {
        setOrders(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => {
        setOrders([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }

  function updateFilter(name: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o._id)));
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir as ${selectedIds.size} vendas selecionadas?`)) {
      return;
    }
    setDeleting(true);
    try {
      const promises = Array.from(selectedIds).map(id => apiDelete(`/sales-orders/${id}`));
      await Promise.all(promises);
      setSelectedIds(new Set());
      loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir vendas.');
    } finally {
      setDeleting(false);
    }
  }

  function handleRowClick(e: React.MouseEvent, id: string) {
    // se clicou no checkbox, não navega
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') {
      return;
    }
    router.push(`/vendas/${id}`);
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link></p>
          <h1>Vendas</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedIds.size > 0 && (
            <button 
              type="button" 
              className="link-action" 
              style={{ color: '#c53030', borderColor: '#c53030' }}
              onClick={handleDeleteSelected}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : `Excluir Selecionados (${selectedIds.size})`}
            </button>
          )}
          <Link className="primary-action" href="/new-sale">Nova venda</Link>
        </div>
      </section>

      <section className="panel form-section">
        <h2>Filtros</h2>
        <div className="filters-grid">
          <label>Número da venda
            <input value={filters.orderNumber} onChange={(event) => updateFilter('orderNumber', event.target.value)} />
          </label>
          <label>Cliente
            <input value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} />
          </label>
          <label>Produtor
            <input value={filters.producer} onChange={(event) => updateFilter('producer', event.target.value)} />
          </label>
          <label>Data
            <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
          </label>
          <label>Status
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="confirmed">Confirmada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="table">
          <div className="table-row sales-table-head">
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                type="checkbox" 
                checked={orders.length > 0 && selectedIds.size === orders.length}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer', width: '18px', height: '18px', minHeight: 'auto' }}
              />
            </span>
            <span>Venda</span>
            <span>Data</span>
            <span>Produto</span>
            <span>Cliente</span>
            <span>Produtor</span>
            <span>Sacos</span>
            <span>Total</span>
            <span>Líquido</span>
            <span>Valor NF</span>
            <span>Status</span>
          </div>
          {orders.map((order) => (
            <div 
              className="table-row sales-table-row" 
              key={order._id} 
              onClick={(e) => handleRowClick(e, order._id)}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(order._id)}
                  onChange={() => toggleSelect(order._id)}
                  style={{ cursor: 'pointer', width: '18px', height: '18px', minHeight: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </span>
              <span>
                {order.orderNumber}
                <span style={{ fontSize: '11px', color: '#526052', background: '#e1e7da', borderRadius: '4px', padding: '2px 6px', marginLeft: '8px', fontWeight: 600 }}>
                  {order.saleType === 'compra_venda' ? 'Revenda' : 'Particular'}
                </span>
              </span>
              <span>{formatDate(order.date)}</span>
              <span>{order.items?.length === 1 ? order.items[0].productId?.name : (order.items && order.items.length > 1 ? 'Vários' : '-')}</span>
              <span>{order.customerId?.name ?? '-'}</span>
              <span>{order.producerId?.name ?? '-'}</span>
              <span>{order.totalBags ?? 0}</span>
              <span>{money(order.totalParticularAmount ?? 0)}</span>
              <span>{money(order.totalReceivableAmount ?? 0)}</span>
              <span>{order.fiscalDocumentAmount ? money(order.fiscalDocumentAmount) : '-'}</span>
              <span>{statusLabel(order.status)}</span>
            </div>
          ))}
          {!loading && orders.length === 0 ? <p className="empty" style={{ marginTop: '15px' }}>Nenhuma venda encontrada.</p> : null}
        </div>
        {orders.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 1rem' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>
              Exibindo {orders.length} de {total} vendas (Página {page})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="link-action compact-action" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </button>
              <button className="link-action compact-action" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>
                Próxima
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function matches(value: string | undefined, filter: string) {
  return !filter || (value ?? '').toLowerCase().includes(filter.toLowerCase());
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
  };
  return labels[status] ?? status;
}

