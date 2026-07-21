'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import './page.css';

type User = {
  _id?: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  password?: string;
  twoFactorEnabled?: boolean;
};

const MODULES = [
  { id: 'comercial', label: 'Comercial' },
  { id: 'financeiro', label: 'Financeiro & Fiscal' },
  { id: 'cadastros', label: 'Cadastros & Inteligência' },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    password: '',
    role: 'broker',
    permissions: [],
    twoFactorEnabled: false,
  });

  const loadUsers = async () => {
    try {
      const data = await apiGet<User[]>('/users');
      setUsers(data);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar usuários.');
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'broker',
      permissions: [],
      twoFactorEnabled: false,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Deixa em branco para manter a senha atual
      role: user.role || 'broker',
      permissions: user.permissions || [],
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    });
    setIsFormOpen(true);
  };

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

    const payload: Record<string, any> = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      permissions: formData.permissions || [],
      twoFactorEnabled: formData.twoFactorEnabled ?? false,
    };

    if (formData.password && formData.password.trim() !== '') {
      payload.password = formData.password;
    }

    try {
      if (editingUser && editingUser._id) {
        await apiPatch(`/users/${editingUser._id}`, payload);
        toast.success(`Usuário ${formData.name} atualizado com sucesso!`);
      } else {
        if (!formData.password) {
          toast.error('Informe a senha para novos usuários.');
          return;
        }
        await apiPost('/users', payload);
        toast.success(`Usuário ${formData.name} cadastrado com sucesso!`);
      }

      setIsFormOpen(false);
      setEditingUser(null);
      void loadUsers();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao salvar usuário.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!user._id) return;
    const confirm = window.confirm(`Tem certeza que deseja desativar o usuário "${user.name}"?`);
    if (!confirm) return;

    try {
      await apiDelete(`/users/${user._id}`);
      toast.success(`Usuário ${user.name} desativado.`);
      void loadUsers();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover usuário.');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'broker': return 'Corretor / Vendedor';
      case 'financial': return 'Financeiro';
      case 'accountant': return 'Contador';
      default: return role;
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
        <button className="btn-primary" onClick={openCreateModal}>
          + Novo Usuário
        </button>
      </header>

      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingUser ? `Editar Usuário: ${editingUser.name}` : 'Novo Usuário'}</h3>
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
                <label>
                  Senha {editingUser ? '(deixe em branco para manter a atual)' : ''}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={8}
                  placeholder={editingUser ? '••••••••' : 'Digite a senha (min. 8 caracteres)'}
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

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="permission-checkbox" style={{ fontWeight: 600, color: '#16a34a' }}>
                  <input
                    type="checkbox"
                    checked={formData.twoFactorEnabled ?? false}
                    onChange={(e) => setFormData({ ...formData, twoFactorEnabled: e.target.checked })}
                  />
                  🔒 Ativar Autenticação de Dois Fatores (2FA em 2 Etapas)
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
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
              <th>Segurança 2FA</th>
              <th>Permissões</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>{getRoleLabel(u.role)}</td>
                <td>
                  {u.twoFactorEnabled ? (
                    <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                      🔒 2FA Ativo
                    </span>
                  ) : (
                    <span className="badge-empty">Desativado</span>
                  )}
                </td>
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
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => openEditModal(u)}
                      style={{ padding: '4px 10px', fontSize: '13px' }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleDeleteUser(u)}
                      style={{ padding: '4px 10px', fontSize: '13px', color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      🗑️ Desativar
                    </button>
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
