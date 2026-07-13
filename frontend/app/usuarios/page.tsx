'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import './page.css';

type User = {
  _id?: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  password?: string;
};

const MODULES = [
  { id: 'comercial', label: 'Comercial' },
  { id: 'financeiro', label: 'Financeiro & Fiscal' },
  { id: 'cadastros', label: 'Cadastros & Inteligência' },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({ role: 'broker', permissions: [] });

  const loadUsers = async () => {
    try {
      const data = await apiGet<User[]>('/users');
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handlePermissionToggle = (moduleId: string) => {
    const current = formData.permissions || [];
    if (current.includes(moduleId)) {
      setFormData({ ...formData, permissions: current.filter((id) => id !== moduleId) });
    } else {
      setFormData({ ...formData, permissions: [...current, moduleId] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/users', formData);
      setFormData({ role: 'broker', permissions: [] });
      setIsFormOpen(false);
      loadUsers();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar usuário');
    }
  };

  return (
    <div className="usuarios-page">
      <header className="page-header">
        <div className="header-actions">
          <Link href="/" className="btn-back">
            ← Voltar
          </Link>
          <h2>Gestão de Usuários</h2>
        </div>
        <button className="btn-primary" onClick={() => setIsFormOpen(true)}>
          + Novo Usuário
        </button>
      </header>

      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Novo Usuário</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>E-mail</label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Perfil (Role)</label>
                <select
                  value={formData.role || 'broker'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="admin">Administrador</option>
                  <option value="broker">Corretor / Vendedor</option>
                  <option value="financial">Financeiro</option>
                  <option value="accountant">Contador</option>
                </select>
              </div>

              <div className="form-group">
                <label>Permissões de Acesso (Módulos)</label>
                <div className="permissions-list">
                  {MODULES.map((mod) => (
                    <label key={mod.id} className="permission-checkbox">
                      <input
                        type="checkbox"
                        checked={(formData.permissions || []).includes(mod.id)}
                        onChange={() => handlePermissionToggle(mod.id)}
                      />
                        {mod.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="list-container">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Permissões</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <div className="badges">
                    {(u.permissions || []).length === 0 && <span className="badge-empty">Nenhum</span>}
                    {(u.permissions || []).map((p) => (
                      <span key={p} className="badge">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
