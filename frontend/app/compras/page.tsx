'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiDelete } from '../../lib/api';

type PurchaseOrder = {
  _id: string;
  orderNumber: string;
  date: string;
  status: string;
  totalBags: number;
  totalAmount: number;
  producerId?: { name?: string };
  items?: { productId?: { name?: string } }[];
};

const emptyFilters = {
  orderNumber: '',
  producer: '',
  date: '',
  status: '',
};

export default function PurchasesListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  function loadOrders() {
    setLoading(true);
    apiGet<PurchaseOrder[]>('/purchase-orders')
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = order.date?.slice(0, 10) ?? '';
      return (
        matches(order.orderNumber, filters.orderNumber) &&
        matches(order.producerId?.name, filters.producer) &&
        (!filters.date || orderDate === filters.date) &&
        (!filters.status || order.status === filters.status)
      );
    });
  }, [orders, filters]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o._id)));
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
    if (!window.confirm(`Tem certeza que deseja excluir as ${selectedIds.size} compras selecionadas?`)) {
      return;
    }
    setDeleting(true);
    try {
      const promises = Array.from(selectedIds).map(id => apiDelete(`/purchase-orders/${id}`));
      await Promise.all(promises);
      setSelectedIds(new Set());
      loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir compras.');
    } finally {
      setDeleting(false);
    }
  }

  function handleRowClick(e: React.MouseEvent, id: string) {
    // se clicou no checkbox, não navega
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') {
      return;
    }
    router.push(`/compras/${id}`);
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link></p>
          <h1>Compras</h1>
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
          <Link className="primary-action" href="/new-purchase">Nova compra</Link>
        </div>
      </section>

      <section className="panel form-section">
        <h2>Filtros</h2>
        <div className="filters-grid">
          <label>Número da compra
            <input value={filters.orderNumber} onChange={(event) => updateFilter('orderNumber', event.target.value)} />
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
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer', width: '18px', height: '18px', minHeight: 'auto' }}
              />
            </span>
            <span>Compra</span>
            <span>Data</span>
            <span>Produto</span>
            <span>Produtor</span>
            <span>Sacos</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          {filtered.map((order) => (
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
              <span>{order.orderNumber}</span>
              <span>{formatDate(order.date)}</span>
              <span>{order.items?.length === 1 ? order.items[0].productId?.name : (order.items && order.items.length > 1 ? 'Vários' : '-')}</span>
              <span>{order.producerId?.name ?? '-'}</span>
              <span>{order.totalBags ?? 0}</span>
              <span>{money(order.totalAmount ?? 0)}</span>
              <span>{statusLabel(order.status)}</span>
            </div>
          ))}
          {!loading && filtered.length === 0 ? <p className="empty" style={{ marginTop: '15px' }}>Nenhuma compra encontrada.</p> : null}
        </div>
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

