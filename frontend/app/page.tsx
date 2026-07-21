'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, logout as clearSession } from '../lib/api';

type CurrentUser = {
  name: string;
  email: string;
  role: string;
  permissions?: string[];
};

type DashboardSummary = {
  salesCountMonth: number;
  salesAmountMonth: number;
  totalReceivableOpen: number;
  totalReceivableOverdue: number;
  totalReceivedMonth: number;
  profitMonth: number;
  totalPayableOpen: number;
  fiscalPendingCount: number;
  fiscalDivergentCount: number;
  recentTransactions?: { type: string; date: string; amount: number }[];
  chartData?: number[];
};

const emptySummary: DashboardSummary = {
  salesCountMonth: 0,
  salesAmountMonth: 0,
  totalReceivableOpen: 0,
  totalReceivableOverdue: 0,
  totalReceivedMonth: 0,
  profitMonth: 0,
  totalPayableOpen: 0,
  fiscalPendingCount: 0,
  fiscalDivergentCount: 0,
};

export default function Home() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Accordion state for sidebar
  const [openGroup, setOpenGroup] = useState<string | null>('comercial');

  const fetchDashboard = () => {
    let url = '/dashboard/summary';
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    if (params.toString()) {
      url += '?' + params.toString();
    }
    apiGet<DashboardSummary>(url)
      .then(setSummary)
      .catch(() => setSummary(emptySummary))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiGet<CurrentUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        clearSession();
        router.push('/login');
      });

    fetchDashboard();
  }, [router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function money(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const isAdmin = user?.role === 'admin';
  const perms = user?.permissions || [];
  
  const canComercial = isAdmin || perms.includes('comercial');
  const canFinanceiro = isAdmin || perms.includes('financeiro');
  const canCadastros = isAdmin || perms.includes('cadastros');

  const toggleGroup = (group: string) => {
    setOpenGroup(openGroup === group ? null : group);
  };

  return (
    <div className="app-layout grid-bg">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>AgroVenda</h2>
        </div>
        <nav className="sidebar-nav">
          <Link href="/" className="sidebar-link active">
            <span className="icon">🏠</span> Dashboard
          </Link>

          {canComercial && (
            <div className={`nav-group ${openGroup === 'comercial' ? 'open' : ''}`}>
              <button className="nav-group-btn" onClick={() => toggleGroup('comercial')}>
                <div className="btn-content">
                  <span className="icon">📊</span> Comercial
                </div>
                <span className="chevron">▼</span>
              </button>
              <div className="nav-group-items">
                <Link href="/new-purchase">📥 Nova Compra</Link>
                <Link href="/new-sale">📤 Nova Venda</Link>
                <Link href="/compras">📄 Hist. Compras</Link>
                <Link href="/vendas">📋 Hist. Vendas</Link>
              </div>
            </div>
          )}

          {canFinanceiro && (
            <div className={`nav-group ${openGroup === 'financeiro' ? 'open' : ''}`}>
              <button className="nav-group-btn" onClick={() => toggleGroup('financeiro')}>
                <div className="btn-content">
                  <span className="icon">💰</span> Financeiro & Fiscal
                </div>
                <span className="chevron">▼</span>
              </button>
              <div className="nav-group-items">
                <Link href="/financeiro/cash-flow">📈 Fluxo de Caixa</Link>
                <Link href="/agenda">📅 Agenda & Alertas</Link>
                <Link href="/financeiro/receber">💵 A Receber</Link>
                <Link href="/financeiro/pagar">💸 A Pagar</Link>
                <Link href="/fiscal">🧾 Fiscal</Link>
              </div>
            </div>
          )}

          {canCadastros && (
            <div className={`nav-group ${openGroup === 'cadastros' ? 'open' : ''}`}>
              <button className="nav-group-btn" onClick={() => toggleGroup('cadastros')}>
                <div className="btn-content">
                  <span className="icon">📋</span> Cadastros
                </div>
                <span className="chevron">▼</span>
              </button>
              <div className="nav-group-items">
                <Link href="/partners">👥 Parceiros</Link>
                <Link href="/products">📦 Produtos</Link>
                <Link href="/relatorios">📊 Relatórios</Link>
                <Link href="/alertas">⚠️ Alertas</Link>
                {isAdmin && <Link href="/usuarios">👤 Usuários</Link>}
                {isAdmin && <Link href="/backup">💾 Backup & Restauração</Link>}
              </div>
            </div>
          )}

        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="welcome-text">
            <h1>Bem-vindo de volta, {user?.name ?? 'Admin'}</h1>
          </div>
          <div className="user-profile">
            <div className="avatar">
              <img src={`https://ui-avatars.com/api/?name=${user?.name || 'Admin'}&background=2f7a45&color=fff`} alt="Avatar" />
            </div>
            <div className="user-info">
              <strong>{user?.name ?? 'Admin'}</strong>
              <small onClick={logout} style={{cursor: 'pointer'}}>Sair</small>
            </div>
          </div>
        </header>

        <div className="filter-bar" style={{ display: 'flex', gap: '1rem', padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #e1e8ed', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#657786' }}>Data Inicial:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="input-field" 
              style={{ width: '140px', padding: '0.4rem', border: '1px solid #e1e8ed', borderRadius: '4px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#657786' }}>Data Final:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="input-field" 
              style={{ width: '140px', padding: '0.4rem', border: '1px solid #e1e8ed', borderRadius: '4px' }}
            />
          </div>
          <button 
            onClick={fetchDashboard}
            style={{ padding: '0.4rem 1rem', background: '#2f7a45', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Filtrar Período
          </button>
        </div>

        <section className="metrics-grid">
          <div className="metric-card">
            <span>VENDAS DO PERÍODO <span className="trend up">↗️</span></span>
            <strong>{summary.salesCountMonth}</strong>
            <small className="badge-gray">vendas</small>
          </div>
          <div className="metric-card">
            <span>TOTAL VENDIDO (KPI)</span>
            <strong>{money(summary.salesAmountMonth)}</strong>
            <small className="text-gray">📈 +0%</small>
          </div>
          <div className="metric-card">
            <span>TOTAL A RECEBER</span>
            <strong>{money(summary.totalReceivableOpen)}</strong>
          </div>
          <div className="metric-card">
            <span>TOTAL A PAGAR</span>
            <strong>{money(summary.totalPayableOpen)}</strong>
          </div>
          <div className="metric-card">
            <span>LUCRATIVIDADE BRUTA</span>
            <strong>{money(summary.profitMonth)}</strong>
            <small className="text-gray">✓ meta atingida</small>
          </div>
        </section>

        <section className="alerts-row">
          <Link href="/alertas" className="alert-card danger">
            <span className="icon">🕒</span>
            <div>
              <span>VENCIDOS</span>
              <strong>{money(summary.totalReceivableOverdue)}</strong>
            </div>
          </Link>
          <Link href="/fiscal" className="alert-card warning">
            <span className="icon">📄</span>
            <div>
              <span>NOTAS PENDENTES</span>
              <strong>{summary.fiscalPendingCount}</strong>
            </div>
          </Link>
          <Link href="/alertas" className="alert-card danger">
            <span className="icon">⚠️</span>
            <div>
              <span>DIVERGENTES</span>
              <strong>{summary.fiscalDivergentCount}</strong>
            </div>
          </Link>
        </section>

        <section className="charts-grid" style={{ marginTop: '24px' }}>
          <div className="chart-panel panel">
            <h3>INDICADORES DE DESEMPENHO (ÚLTIMOS 7 DIAS)</h3>
            <div className="chart-placeholder">
              <svg viewBox="0 0 400 100" className="fake-chart">
                {(() => {
                  const data = summary.chartData || [0,0,0,0,0,0,0];
                  const maxVal = Math.max(...data, 1);
                  const width = 400;
                  const height = 100;
                  const stepX = width / (data.length - 1 || 1);
                  const points = data.map((val, idx) => {
                    const x = idx * stepX;
                    const y = height - (val / maxVal) * (height - 20);
                    return `${x} ${y}`;
                  });
                  const strokePath = `M ${points.map((p, i) => (i === 0 ? p : `L ${p}`)).join(' ')}`;
                  const fillPath = `${strokePath} L ${width} ${height} L 0 ${height} Z`;
                  return (
                    <>
                      <path d={fillPath} fill="#2f7a4533" />
                      <path d={strokePath} stroke="#2f7a45" strokeWidth="2" fill="none" />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
          <div className="transactions-panel panel">
            <h3>ÚLTIMAS 5 TRANSAÇÕES</h3>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Módulo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentTransactions && summary.recentTransactions.length > 0 ? (
                  summary.recentTransactions.map((tx, idx) => (
                    <tr key={idx}>
                      <td>{new Date(tx.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                      <td>{tx.type}</td>
                      <td>{money(tx.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>Nenhuma transação recente</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

