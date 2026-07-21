'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';

type Product = {
  _id: string;
  name: string;
  category?: string;
  defaultUnit: string;
  defaultWeightKg?: number;
  internalCode: string;
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('caixa');
  const [defaultWeightKg, setDefaultWeightKg] = useState<number>(20);
  const [internalCode, setInternalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  function loadProducts() {
    apiGet<Product[]>('/products').then(setItems).catch(() => setItems([]));
  }

  function handleUnitChange(newUnit: string) {
    setDefaultUnit(newUnit);
    // Sugerir peso padrão de acordo com o tipo de embalagem se não foi alterado manualmente
    if (newUnit === 'caixa') {
      setDefaultWeightKg(20);
    } else if (newUnit === 'saco') {
      setDefaultWeightKg(25);
    } else if (newUnit === 'saca') {
      setDefaultWeightKg(60);
    } else if (newUnit === 'kg') {
      setDefaultWeightKg(1);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await apiDelete(`/products/${id}`);
      setMessage('Produto excluído com sucesso!');
      loadProducts();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao excluir produto.');
    }
  }

  function handleEdit(product: Product) {
    setEditingId(product._id);
    setName(product.name);
    setCategory(product.category || '');
    setDefaultUnit(product.defaultUnit || 'caixa');
    setDefaultWeightKg(product.defaultWeightKg ?? (product.defaultUnit === 'caixa' ? 20 : 25));
    setInternalCode(product.internalCode || '');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setName('');
    setCategory('');
    setDefaultUnit('caixa');
    setDefaultWeightKg(20);
    setInternalCode('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = {
        name,
        category,
        defaultUnit,
        defaultWeightKg: Number(defaultWeightKg) || 0,
        internalCode,
      };

      if (editingId) {
        await apiPatch(`/products/${editingId}`, payload);
        setMessage('Produto atualizado com sucesso!');
      } else {
        await apiPost('/products', payload);
        setMessage('Produto cadastrado com sucesso!');
      }
      handleCancelEdit();
      loadProducts();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  }

  const getUnitLabel = (unit: string, weight?: number) => {
    let label = unit;
    switch (unit) {
      case 'caixa': label = 'Caixa (cx)'; break;
      case 'saco': label = 'Saco (sc)'; break;
      case 'saca': label = 'Saca (sc)'; break;
      case 'kg': label = 'Quilograma (kg)'; break;
      case 'tonelada': label = 'Tonelada (ton)'; break;
      case 'unidade': label = 'Unidade (un)'; break;
      case 'pacote': label = 'Pacote (pct)'; break;
    }
    if (weight && weight > 0 && unit !== 'kg') {
      return `${label} - ${weight} kg`;
    }
    return label;
  };

  return (
    <main className="shell">
      <section className="header compact">
        <p><Link href="/">Inicio</Link></p>
        <h1>Gestão de Produtos e Embalagens</h1>
      </section>

      <section className="panel form-section" style={{ marginBottom: '20px' }}>
        <h2>{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>Nome do Produto
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: CENOURA, BATATA, CAFÉ"
              required
            />
          </label>

          <label>Categoria
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Ex: Hortaliça, Fruta, Grãos"
            />
          </label>

          <label>Código Interno
            <input
              value={internalCode}
              onChange={e => setInternalCode(e.target.value)}
              placeholder="Ex: 0706"
              required
            />
          </label>

          <label>Tipo de Embalagem / Unidade Padrão
            <select value={defaultUnit} onChange={e => handleUnitChange(e.target.value)}>
              <option value="caixa">📦 Caixa (cx)</option>
              <option value="saco">🛍️ Saco (sc)</option>
              <option value="saca">☕ Saca de Grãos (sc)</option>
              <option value="kg">⚖️ Quilograma (KG)</option>
              <option value="tonelada">🚛 Tonelada (ton)</option>
              <option value="unidade">🔢 Unidade (un)</option>
              <option value="pacote">📦 Pacote / Fardo (pct)</option>
            </select>
          </label>

          <label>
            Peso por Caixa/Saco (KG)
            <input
              type="number"
              step="0.1"
              min="0"
              value={defaultWeightKg}
              onChange={e => setDefaultWeightKg(parseFloat(e.target.value) || 0)}
              placeholder="Ex: 20 para Caixa, 25 para Saco"
              required
            />
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
              💡 Peso de 1 {defaultUnit === 'caixa' ? 'Caixa' : defaultUnit === 'saco' ? 'Saco' : 'Unidade'} em KG para cálculo de frete e total
            </span>
          </label>

          <div style={{ gridColumn: '1 / -1', marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="submit" className="primary-action" disabled={loading}>
              {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar Produto')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{ padding: '0.75rem 1.5rem', background: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancelar
              </button>
            )}
            {message && <span style={{ marginLeft: '10px', color: message.includes('sucesso') ? 'green' : 'red', fontWeight: 600 }}>{message}</span>}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="table">
          <div className="table-row table-head">
            <span>Nome</span>
            <span>Categoria</span>
            <span>Embalagem / Unidade</span>
            <span>Código</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {items.map((item) => (
            <div className="table-row" key={item._id}>
              <span><strong>{item.name}</strong></span>
              <span>{item.category || '-'}</span>
              <span>
                <span className="badge" style={{ background: '#f0fdf4', color: '#166534', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>
                  {getUnitLabel(item.defaultUnit, item.defaultWeightKg)}
                </span>
              </span>
              <span><code>{item.internalCode}</code></span>
              <span style={{ textAlign: 'right' }}>
                <button
                  onClick={() => handleEdit(item)}
                  style={{ padding: '4px 8px', background: '#0052cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '8px' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(item._id)}
                  style={{ padding: '4px 8px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Excluir
                </button>
              </span>
            </div>
          ))}
          {items.length === 0 && <p className="empty" style={{ padding: '15px' }}>Nenhum produto cadastrado.</p>}
        </div>
      </section>
    </main>
  );
}
