'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
type Product = { _id: string; name: string; category?: string; defaultUnit: string; internalCode: string };

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('kg');
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
    setDefaultUnit(product.defaultUnit || 'kg');
    setInternalCode(product.internalCode || '');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setName('');
    setCategory('');
    setDefaultUnit('kg');
    setInternalCode('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = { name, category, defaultUnit, internalCode };
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

  return (
    <main className="shell">
      <section className="header compact">
        <p><Link href="/">Inicio</Link></p>
        <h1>Produtos</h1>
      </section>

      <section className="panel form-section" style={{ marginBottom: '20px' }}>
        <h2>{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>Nome do Produto
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>Categoria
            <input value={category} onChange={e => setCategory(e.target.value)} />
          </label>
          <label>Código Interno
            <input value={internalCode} onChange={e => setInternalCode(e.target.value)} required />
          </label>
          <label>Unidade Padrão
            <select value={defaultUnit} onChange={e => setDefaultUnit(e.target.value)}>
              <option value="kg">KG</option>
              <option value="caixa">Caixa</option>
              <option value="saca">Saca</option>
              <option value="tonelada">Tonelada</option>
              <option value="unidade">Unidade</option>
            </select>
          </label>
          <div style={{ gridColumn: '1 / -1', marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="submit" className="primary-action" disabled={loading}>
              {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar Produto')}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} style={{ padding: '0.75rem 1.5rem', background: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cancelar
              </button>
            )}
            {message && <span style={{ marginLeft: '10px', color: message.includes('sucesso') ? 'green' : 'red' }}>{message}</span>}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="table">
          <div className="table-row table-head"><span>Nome</span><span>Categoria</span><span>Unidade</span><span>Codigo</span><span style={{ textAlign: 'right' }}>Ações</span></div>
          {items.map((item) => (
            <div className="table-row" key={item._id}>
              <span>{item.name}</span>
              <span>{item.category}</span>
              <span>{item.defaultUnit}</span>
              <span>{item.internalCode}</span>
              <span style={{ textAlign: 'right' }}>
                <button onClick={() => handleEdit(item)} style={{ padding: '4px 8px', background: '#0052cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '8px' }}>Editar</button>
                <button onClick={() => handleDelete(item._id)} style={{ padding: '4px 8px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Excluir</button>
              </span>
            </div>
          ))}
          {items.length === 0 && <p className="empty" style={{ padding: '15px' }}>Nenhum produto cadastrado.</p>}
        </div>
      </section>
    </main>
  );
}
