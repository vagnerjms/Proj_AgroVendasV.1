'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet } from '../../lib/api';
import './page.css';

type Entity = {
  _id: string;
  name: string;
};

export default function RelatoriosPage() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customers, setCustomers] = useState<Entity[]>([]);
  const [producers, setProducers] = useState<Entity[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProducer, setSelectedProducer] = useState('');

  useEffect(() => {
    apiGet<Entity[]>('/customers')
      .then((res: any) => setCustomers(res.data || res))
      .catch((err) => console.error('Error fetching customers', err));

    apiGet<Entity[]>('/producers')
      .then((res: any) => setProducers(res.data || res))
      .catch((err) => console.error('Error fetching producers', err));
  }, []);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      `/relatorios/loja?start=${dateFrom}&end=${dateTo}&customerId=${selectedCustomer}&producerId=${selectedProducer}`
    );
  };

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '4rem auto 0 auto', padding: '0 1rem' }}>
      <header className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" className="back-link" style={{ display: 'inline-block', fontSize: '0.9rem', color: '#0052cc', textDecoration: 'none', fontWeight: 500 }}>
            ← Voltar ao Dashboard
          </Link>
        </div>
        <h1 style={{ fontSize: '2rem', color: '#1a1a1a', marginBottom: '0.5rem' }}>Relatórios de Vendas</h1>
        <p style={{ color: '#666', fontSize: '1rem' }}>Selecione os filtros desejados para gerar o modelo visual consolidado.</p>
      </header>

      <div className="panel form-section relatorios-panel" style={{ padding: '2.5rem', borderRadius: '12px', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #eaeaea' }}>
        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
          <div className="dates-row">
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>
              Data Inicial
              <input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
                style={{ padding: '0.8rem', border: '1px solid #dcdcdc', borderRadius: '8px', fontSize: '1rem', color: '#333', outline: 'none', transition: 'border-color 0.2s' }}
              />
            </label>
            
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>
              Data Final
              <input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)} 
                style={{ padding: '0.8rem', border: '1px solid #dcdcdc', borderRadius: '8px', fontSize: '1rem', color: '#333', outline: 'none', transition: 'border-color 0.2s' }}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>
            Cliente (Loja)
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              style={{ padding: '0.8rem', border: '1px solid #dcdcdc', borderRadius: '8px', fontSize: '1rem', color: '#333', outline: 'none', background: '#fff' }}
            >
              <option value="">Todos os Clientes</option>
              {customers.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>
            Produtor (Fornecedor)
            <select
              value={selectedProducer}
              onChange={e => setSelectedProducer(e.target.value)}
              style={{ padding: '0.8rem', border: '1px solid #dcdcdc', borderRadius: '8px', fontSize: '1rem', color: '#333', outline: 'none', background: '#fff' }}
            >
              <option value="">Todos os Produtores</option>
              <option value="agrovendas">AgroVendas (Estoque Próprio)</option>
              {producers.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </label>
          
          <button 
            type="submit" 
            className="generate-btn" 
            style={{ 
              background: '#0052cc', 
              color: '#fff', 
              border: 'none', 
              padding: '1rem', 
              fontSize: '1.1rem', 
              fontWeight: 600, 
              borderRadius: '8px', 
              cursor: 'pointer',
              textAlign: 'center',
              marginTop: '1rem',
              boxShadow: '0 4px 12px rgba(0, 82, 204, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            Gerar Modelo em PDF (Visual)
          </button>
        </form>
      </div>
    </div>
  );
}
