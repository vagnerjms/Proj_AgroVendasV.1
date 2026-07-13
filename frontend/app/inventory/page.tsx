'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

type Lot = {
  _id?: string;
  producerId: any;
  productId: any;
  quantityBags: number;
  bagWeightKg: number;
  cropYear: string;
  location: string;
  status: string;
  notes?: string;
};

export default function InventoryPage() {
  const [items, setItems] = useState<Lot[]>([]);
  const [producers, setProducers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lot>>({ bagWeightKg: 25, status: 'available' });

  const loadData = async () => {
    try {
      const [lotsData, producersData, productsData] = await Promise.all([
        apiGet<Lot[]>('/lots').catch(() => []),
        apiGet<any[]>('/producers').catch(() => []),
        apiGet<any[]>('/products').catch(() => []),
      ]);
      setItems(lotsData);
      setProducers(producersData);
      setProducts(productsData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/lots', {
        ...formData,
        quantityBags: Number(formData.quantityBags),
        bagWeightKg: Number(formData.bagWeightKg),
      });
      setIsFormOpen(false);
      setFormData({ bagWeightKg: 25, status: 'available' });
      loadData();
    } catch (error) {
      alert('Erro ao salvar lote');
      console.error(error);
    }
  };

  return (
    <main className="shell">
      <section className="header compact">
        <p><Link href="/">Inicio</Link></p>
        <h1>Painel de Estoque / Lotes</h1>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="btn primary">
          {isFormOpen ? 'Cancelar' : 'Registrar Lote'}
        </button>
      </section>

      {isFormOpen && (
        <section className="panel" style={{ marginBottom: '20px' }}>
          <h2>Novo Lote</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Produtor</label>
                <select required value={formData.producerId || ''} onChange={(e) => setFormData({ ...formData, producerId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {producers.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>Produto</label>
                <select required value={formData.productId || ''} onChange={(e) => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">Selecione...</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Qtd Sacas</label>
                <input type="number" required value={formData.quantityBags || ''} onChange={(e) => setFormData({ ...formData, quantityBags: Number(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Peso Saca (kg)</label>
                <input type="number" required value={formData.bagWeightKg || ''} onChange={(e) => setFormData({ ...formData, bagWeightKg: Number(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Safra</label>
                <input required value={formData.cropYear || ''} onChange={(e) => setFormData({ ...formData, cropYear: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Local de Retirada</label>
                <input required value={formData.location || ''} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="available">Disponível</option>
                  <option value="reserved">Reservado</option>
                  <option value="sold">Vendido</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn primary">Salvar Lote</button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="table">
          <div className="table-row table-head">
            <span>Produtor</span>
            <span>Produto</span>
            <span>Safra</span>
            <span>Local</span>
            <span>Qtd (Sacas)</span>
            <span>Status</span>
          </div>
          {items.map((item) => (
            <div className="table-row" key={item._id}>
              <span>{item.producerId?.name || 'N/A'}</span>
              <span>{item.productId?.name || 'N/A'}</span>
              <span>{item.cropYear}</span>
              <span>{item.location}</span>
              <span>{item.quantityBags}</span>
              <span style={{ fontWeight: 'bold', color: item.status === 'available' ? 'green' : item.status === 'reserved' ? 'orange' : 'red' }}>
                {item.status === 'available' ? 'Disponível' : item.status === 'reserved' ? 'Reservado' : 'Vendido'}
              </span>
            </div>
          ))}
          {items.length === 0 ? <p className="empty">Nenhum lote cadastrado.</p> : null}
        </div>
      </section>
    </main>
  );
}
