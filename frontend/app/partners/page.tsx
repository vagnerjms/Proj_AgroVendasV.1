'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch } from '../../lib/api';

type Partner = {
  _id?: string;
  name: string;
  documentNumber: string;
  stateRegistration: string;
  city: string;
  state: string;
  type: 'producer' | 'customer';
  bankAccount?: string;
  deliveryAddress?: string;
};

export default function PartnersPage() {
  const [items, setItems] = useState<Partner[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Partner>>({ type: 'producer' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadPartners = async () => {
    try {
      const [producers, customers] = await Promise.all([
        apiGet<any[]>('/producers').catch(() => []),
        apiGet<any[]>('/customers').catch(() => []),
      ]);
      const formattedProducers = producers.map((p) => ({ ...p, type: 'producer' as const }));
      const formattedCustomers = customers.map((c) => ({ ...c, type: 'customer' as const }));
      setItems([...formattedProducers, ...formattedCustomers]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const handleOpenNew = () => {
    setFormData({ type: 'producer' });
    setEditingId(null);
    setIsFormOpen(!isFormOpen);
  };

  const handleEdit = (partner: Partner) => {
    setFormData({
      type: partner.type,
      name: partner.name,
      documentNumber: partner.documentNumber,
      stateRegistration: partner.stateRegistration,
      city: partner.city,
      state: partner.state,
      bankAccount: partner.bankAccount,
      deliveryAddress: partner.deliveryAddress,
    });
    setEditingId(partner._id || null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = formData.type === 'producer' ? '/producers' : '/customers';
      const cleanDoc = formData.documentNumber?.replace(/\D/g, '') || '';
      const payload = {
        name: formData.name,
        documentNumber: formData.documentNumber,
        documentType: cleanDoc.length === 11 ? 'cpf' : 'cnpj',
        stateRegistration: formData.stateRegistration,
        city: formData.city,
        state: formData.state,
        bankAccount: formData.bankAccount,
        deliveryAddress: formData.deliveryAddress,
      };

      if (editingId) {
        await apiPatch(`${endpoint}/${editingId}`, payload);
      } else {
        await apiPost(endpoint, payload);
      }

      setIsFormOpen(false);
      setFormData({ type: 'producer' });
      setEditingId(null);
      loadPartners();
    } catch (error) {
      alert('Erro ao salvar parceiro');
      console.error(error);
    }
  };

  return (
    <main className="shell">
      <section className="header compact">
        <p><Link href="/">Inicio</Link></p>
        <h1>Parceiros (Cadastro Centralizado)</h1>
        <button onClick={handleOpenNew} className="btn primary">
          {isFormOpen ? 'Cancelar' : 'Novo Parceiro'}
        </button>
      </section>

      {isFormOpen && (
        <section className="panel" style={{ marginBottom: '20px' }}>
          <h2>{editingId ? 'Editar Cadastro' : 'Novo Cadastro'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label>Tipo de Parceiro</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}>
                <option value="producer">Produtor</option>
                <option value="customer">Cliente Final</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Nome / Razão Social</label>
                <input required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>CPF / CNPJ</label>
                <input required value={formData.documentNumber || ''} onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Inscrição Estadual</label>
                <input required={formData.type === 'producer'} value={formData.stateRegistration || ''} onChange={(e) => setFormData({ ...formData, stateRegistration: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Cidade</label>
                <input required value={formData.city || ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Estado (UF)</label>
                <input required maxLength={2} value={formData.state || ''} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
              </div>
            </div>

            {formData.type === 'producer' && (
              <div>
                <label>Banco para Pagamento</label>
                <input value={formData.bankAccount || ''} onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })} />
              </div>
            )}

            {formData.type === 'customer' && (
              <div>
                <label>Endereço de Entrega / Faturamento</label>
                <input value={formData.deliveryAddress || ''} onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })} />
              </div>
            )}

            <button type="submit" className="btn primary">{editingId ? 'Salvar Alterações' : 'Salvar Parceiro'}</button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="table">
          <div className="table-row table-head">
            <span>Tipo</span>
            <span>Nome</span>
            <span>Documento</span>
            <span>IE</span>
            <span>Cidade/UF</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {items.map((item) => (
            <div className="table-row" key={item._id}>
              <span>{item.type === 'producer' ? 'Produtor' : 'Cliente'}</span>
              <span>{item.name}</span>
              <span>{item.documentNumber}</span>
              <span>{item.stateRegistration || '-'}</span>
              <span>{item.city}/{item.state}</span>
              <span style={{ textAlign: 'right' }}>
                <button
                  onClick={() => handleEdit(item)}
                  className="btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    background: '#0052cc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Editar
                </button>
              </span>
            </div>
          ))}
          {items.length === 0 ? <p className="empty">Nenhum parceiro cadastrado.</p> : null}
        </div>
      </section>
    </main>
  );
}
