'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { apiGet, apiPatch } from '../../lib/api';

type Entity = { _id?: string; name?: string };

type Payment = {
  _id: string;
  type: 'receivable' | 'payable';
  orderNumber: string;
  customerName?: string;
  producerName?: string;
  customerId?: Entity;
  producerId?: Entity;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'open' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  method?: string;
};

type PaymentAlerts = {
  receivablesOverdue: Payment[];
  receivablesDueToday: Payment[];
  receivablesDueSoon: Payment[];
  payablesOverdue: Payment[];
  payablesDueToday: Payment[];
  payablesDueSoon: Payment[];
};

type FilterCategory = 'all' | 'overdue' | 'dueToday' | 'dueSoon' | 'receivable' | 'payable';

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterType, setFilterType] = useState<FilterCategory>('all');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [alerts, setAlerts] = useState<PaymentAlerts>({
    receivablesOverdue: [],
    receivablesDueToday: [],
    receivablesDueSoon: [],
    payablesOverdue: [],
    payablesDueToday: [],
    payablesDueSoon: [],
  });

  const [loading, setLoading] = useState(true);
  const dayDetailsRef = useRef<HTMLDivElement | null>(null);

  // Baixa rápida
  const [settlingPayment, setSettlingPayment] = useState<Payment | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<string>('pix');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = async () => {
    setLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const dueDateFrom = new Date(firstDay);
      dueDateFrom.setDate(dueDateFrom.getDate() - 7);
      const dueDateTo = new Date(lastDay);
      dueDateTo.setDate(dueDateTo.getDate() + 7);

      const fromStr = dueDateFrom.toISOString().slice(0, 10);
      const toStr = dueDateTo.toISOString().slice(0, 10);

      const [paymentsData, alertsData] = await Promise.all([
        apiGet<Payment[]>(`/payments?dueDateFrom=${fromStr}&dueDateTo=${toStr}`).catch(() => []),
        apiGet<PaymentAlerts>('/payments/alerts').catch(() => ({
          receivablesOverdue: [],
          receivablesDueToday: [],
          receivablesDueSoon: [],
          payablesOverdue: [],
          payablesDueToday: [],
          payablesDueSoon: [],
        })),
      ]);

      setPayments(paymentsData);
      setAlerts(alertsData);

      // Disparar Notificação na Tela se houver contas vencidas
      const overdueTotalCount = (alertsData.receivablesOverdue?.length || 0) + (alertsData.payablesOverdue?.length || 0);
      if (overdueTotalCount > 0) {
        toast.warning(`⚠️ Atenção: Você possui ${overdueTotalCount} título(s) em atraso!`, {
          toastId: 'overdue-alert-toast',
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados da agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [year, month]);

  // Navegação de mês
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().slice(0, 10));
  };

  // Rolagem suave para os detalhes do dia no mobile ao tocar em uma data
  const handleSelectDay = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    if (window.innerWidth <= 768 && dayDetailsRef.current) {
      dayDetailsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Cálculo da grade do calendário
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dateStr: d.toISOString().slice(0, 10),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
      });
    }

    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateStr: d.toISOString().slice(0, 10),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month]);

  // Mapeamento de pagamentos por data
  const paymentsByDate = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((p) => {
      if (!p.dueDate) return;
      const dateStr = p.dueDate.slice(0, 10);
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(p);
    });
    return map;
  }, [payments]);

  // Pagamentos da data selecionada com base no Seletor de Alertas
  const selectedDayPayments = useMemo(() => {
    const list = paymentsByDate.get(selectedDateStr) ?? [];
    const todayStr = new Date().toISOString().slice(0, 10);

    if (filterType === 'all') return list;
    if (filterType === 'receivable') return list.filter((p) => p.type === 'receivable');
    if (filterType === 'payable') return list.filter((p) => p.type === 'payable');
    if (filterType === 'overdue') {
      return list.filter((p) => (p.status === 'open' || p.status === 'partial') && p.dueDate.slice(0, 10) < todayStr);
    }
    if (filterType === 'dueToday') {
      return list.filter((p) => p.dueDate.slice(0, 10) === todayStr);
    }
    if (filterType === 'dueSoon') {
      const next3 = new Date();
      next3.setDate(next3.getDate() + 3);
      const next3Str = next3.toISOString().slice(0, 10);
      return list.filter((p) => {
        const d = p.dueDate.slice(0, 10);
        return d > todayStr && d <= next3Str;
      });
    }
    return list;
  }, [paymentsByDate, selectedDateStr, filterType]);

  // Totais Rápidos dos Alertas
  const totalOverdueAmount = useMemo(() => {
    const rec = alerts.receivablesOverdue.reduce((acc, p) => acc + (p.balanceAmount ?? p.amount ?? 0), 0);
    const pay = alerts.payablesOverdue.reduce((acc, p) => acc + (p.balanceAmount ?? p.amount ?? 0), 0);
    return { rec, pay, total: rec + pay, count: alerts.receivablesOverdue.length + alerts.payablesOverdue.length };
  }, [alerts]);

  const totalDueTodayAmount = useMemo(() => {
    const rec = alerts.receivablesDueToday.reduce((acc, p) => acc + (p.balanceAmount ?? p.amount ?? 0), 0);
    const pay = alerts.payablesDueToday.reduce((acc, p) => acc + (p.balanceAmount ?? p.amount ?? 0), 0);
    return { rec, pay, total: rec + pay, count: alerts.receivablesDueToday.length + alerts.payablesDueToday.length };
  }, [alerts]);

  const totalDueSoonAmount = useMemo(() => {
    const rec = alerts.receivablesDueSoon.reduce((acc, p) => acc + (p.balanceAmount ?? p.amount ?? 0), 0);
    const pay = alerts.payablesDueSoon.reduce((acc, p) => acc + (p.balanceAmount ?? p.amount ?? 0), 0);
    return { rec, pay, total: rec + pay, count: alerts.receivablesDueSoon.length + alerts.payablesDueSoon.length };
  }, [alerts]);

  // Baixa de Título
  const openSettleModal = (payment: Payment) => {
    setSettlingPayment(payment);
    setSettleAmount(payment.balanceAmount ?? payment.amount);
    setSettleMethod('pix');
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingPayment) return;

    try {
      await apiPatch(`/payments/${settlingPayment._id}/settle`, {
        amount: settleAmount,
        method: settleMethod,
      });
      toast.success(`Baixa efetuada com sucesso para ${settlingPayment.orderNumber}!`);
      setSettlingPayment(null);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao efetuar baixa do título.');
    }
  };

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link> / <Link href="/alertas">Alertas</Link></p>
          <h1>📅 Agenda & Alertas de Vencimentos</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-calendar-nav" onClick={goToday}>Hoje</button>
          <Link className="link-action" href="/financeiro/cash-flow">Fluxo de Caixa</Link>
        </div>
      </section>

      {/* Banner de Alerta Crítico na Tela */}
      {totalOverdueAmount.count > 0 && (
        <section className="agenda-alert-banner critical">
          <div className="agenda-alert-content">
            <span className="agenda-alert-icon">🔴</span>
            <div>
              <div className="agenda-alert-title">
                {totalOverdueAmount.count} Conta(s) Vencida(s) no valor total de {money(totalOverdueAmount.total)}
              </div>
              <div className="agenda-alert-desc">
                Rec: {money(totalOverdueAmount.rec)} a receber | Pag: {money(totalOverdueAmount.pay)} a pagar ao produtor.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="agenda-alert-action-btn"
            onClick={() => setFilterType('overdue')}
          >
            Filtrar Vencidas
          </button>
        </section>
      )}

      {totalOverdueAmount.count === 0 && totalDueTodayAmount.count > 0 && (
        <section className="agenda-alert-banner warning">
          <div className="agenda-alert-content">
            <span className="agenda-alert-icon">🟡</span>
            <div>
              <div className="agenda-alert-title">
                {totalDueTodayAmount.count} Conta(s) Vencem Hoje no valor de {money(totalDueTodayAmount.total)}
              </div>
              <div className="agenda-alert-desc">
                Rec: {money(totalDueTodayAmount.rec)} | Pag: {money(totalDueTodayAmount.pay)}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="agenda-alert-action-btn warning"
            onClick={() => { setFilterType('dueToday'); goToday(); }}
          >
            Ver Compromissos de Hoje
          </button>
        </section>
      )}

      {/* Cards de KPIs no Topo */}
      <section className="agenda-kpi-grid">
        <div
          className={`agenda-kpi-card overdue ${filterType === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilterType('overdue')}
        >
          <div className="agenda-kpi-title">🔴 Vencidas ({totalOverdueAmount.count})</div>
          <div className="agenda-kpi-value">{money(totalOverdueAmount.total)}</div>
          <div className="agenda-kpi-sub">
            Rec: {money(totalOverdueAmount.rec)} | Pag: {money(totalOverdueAmount.pay)}
          </div>
        </div>

        <div
          className={`agenda-kpi-card due-today ${filterType === 'dueToday' ? 'active' : ''}`}
          onClick={() => { setFilterType('dueToday'); goToday(); }}
        >
          <div className="agenda-kpi-title">🟡 Vencem Hoje ({totalDueTodayAmount.count})</div>
          <div className="agenda-kpi-value">{money(totalDueTodayAmount.total)}</div>
          <div className="agenda-kpi-sub">
            Rec: {money(totalDueTodayAmount.rec)} | Pag: {money(totalDueTodayAmount.pay)}
          </div>
        </div>

        <div
          className={`agenda-kpi-card due-soon ${filterType === 'dueSoon' ? 'active' : ''}`}
          onClick={() => setFilterType('dueSoon')}
        >
          <div className="agenda-kpi-title">🔵 Próximos 3 Dias ({totalDueSoonAmount.count})</div>
          <div className="agenda-kpi-value">{money(totalDueSoonAmount.total)}</div>
          <div className="agenda-kpi-sub">
            Rec: {money(totalDueSoonAmount.rec)} | Pag: {money(totalDueSoonAmount.pay)}
          </div>
        </div>
      </section>

      {/* Layout da Agenda: Calendário + Painel de Detalhes Diário */}
      <section className="agenda-layout">
        <div className="calendar-card">
          <div className="calendar-toolbar">
            <h2 className="calendar-month-title">{monthName}</h2>

            {/* Seletor de Alertas & Filtros de Visualização */}
            <div className="alert-selector-bar">
              <button
                type="button"
                className={`alert-selector-pill ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                🌐 Todas
              </button>
              <button
                type="button"
                className={`alert-selector-pill ${filterType === 'overdue' ? 'active overdue' : ''}`}
                onClick={() => setFilterType('overdue')}
              >
                🔴 Vencidas
              </button>
              <button
                type="button"
                className={`alert-selector-pill ${filterType === 'dueToday' ? 'active due-today' : ''}`}
                onClick={() => setFilterType('dueToday')}
              >
                🟡 Hoje
              </button>
              <button
                type="button"
                className={`alert-selector-pill ${filterType === 'receivable' ? 'active' : ''}`}
                onClick={() => setFilterType('receivable')}
              >
                📥 A Receber
              </button>
              <button
                type="button"
                className={`alert-selector-pill ${filterType === 'payable' ? 'active' : ''}`}
                onClick={() => setFilterType('payable')}
              >
                📤 A Pagar
              </button>

              <div className="calendar-nav-buttons" style={{ marginLeft: 'auto' }}>
                <button type="button" className="btn-calendar-nav" onClick={prevMonth}>◀ Mês Ant.</button>
                <button type="button" className="btn-calendar-nav" onClick={nextMonth}>Mês Prox. ▶</button>
              </div>
            </div>
          </div>

          <div className="calendar-grid-header">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          <div className="calendar-grid-body">
            {calendarDays.map((dayItem) => {
              const dayPayments = paymentsByDate.get(dayItem.dateStr) ?? [];

              let recSum = 0;
              let paySum = 0;
              let hasOverdue = false;

              const todayStr = new Date().toISOString().slice(0, 10);

              dayPayments.forEach((p) => {
                if (p.status === 'cancelled') return;
                const bal = p.balanceAmount ?? p.amount ?? 0;
                if (p.type === 'receivable') recSum += bal;
                if (p.type === 'payable') paySum += bal;

                if ((p.status === 'open' || p.status === 'partial') && dayItem.dateStr < todayStr) {
                  hasOverdue = true;
                }
              });

              const isSelected = dayItem.dateStr === selectedDateStr;

              // Esconder badges se o filtro do Seletor de Alertas não bater com a categoria
              const showRec = recSum > 0 && (filterType === 'all' || filterType === 'receivable' || (filterType === 'overdue' && hasOverdue) || (filterType === 'dueToday' && dayItem.isToday));
              const showPay = paySum > 0 && (filterType === 'all' || filterType === 'payable' || (filterType === 'overdue' && hasOverdue) || (filterType === 'dueToday' && dayItem.isToday));

              return (
                <div
                  key={dayItem.dateStr}
                  className={`calendar-day-cell ${!dayItem.isCurrentMonth ? 'other-month' : ''} ${
                    dayItem.isToday ? 'today' : ''
                  } ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDay(dayItem.dateStr)}
                >
                  <div className="calendar-day-header">
                    <span className="day-number">{dayItem.date.getDate()}</span>
                    {hasOverdue && <span className="dot-indicator red" title="Possui contas vencidas!" />}
                    {!hasOverdue && dayItem.isToday && (recSum > 0 || paySum > 0) && (
                      <span className="dot-indicator yellow" title="Vence hoje" />
                    )}
                  </div>

                  <div className="day-events-badges">
                    {showRec && (
                      <div className={`badge-event receivable ${hasOverdue ? 'overdue' : ''}`}>
                        <span>+ {money(recSum)}</span>
                      </div>
                    )}
                    {showPay && (
                      <div className={`badge-event payable ${hasOverdue ? 'overdue' : ''}`}>
                        <span>- {money(paySum)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Dia Selecionado */}
        <aside className="day-details-card" ref={dayDetailsRef}>
          <h2 className="day-details-title">
            Vencimentos do Dia
          </h2>
          <div className="day-details-sub">
            📅 {formatLongDate(selectedDateStr)}
          </div>

          {loading ? (
            <p className="empty">Carregando vencimentos...</p>
          ) : selectedDayPayments.length === 0 ? (
            <p className="empty">Nenhum compromisso financeiro nesta data ({getFilterLabel(filterType)}).</p>
          ) : (
            <div>
              {selectedDayPayments.map((payment) => {
                const isReceivable = payment.type === 'receivable';
                const entityName = isReceivable
                  ? payment.customerName || (payment.customerId as Entity)?.name || 'Cliente'
                  : payment.producerName || (payment.producerId as Entity)?.name || 'Produtor';

                return (
                  <div
                    key={payment._id}
                    className={`payment-item-card ${isReceivable ? 'type-receivable' : 'type-payable'}`}
                  >
                    <div className="payment-item-header">
                      <span className="payment-item-order">{payment.orderNumber}</span>
                      <span className={`status-pill ${payment.status}`}>
                        {formatStatus(payment.status)}
                      </span>
                    </div>

                    <div className="payment-item-entity">
                      {isReceivable ? '📥 Receber de: ' : '📤 Pagar a: '}
                      <strong>{entityName}</strong>
                    </div>

                    <div className="payment-item-amount-row">
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Saldo a Quitar:</div>
                        <div className="payment-item-amount">
                          {money(payment.balanceAmount ?? payment.amount)}
                        </div>
                      </div>

                      {payment.status !== 'paid' && payment.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn-settle-action"
                          onClick={() => openSettleModal(payment)}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </section>

      {/* Modal / Popup de Baixa */}
      {settlingPayment && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '420px', background: '#fff', borderRadius: '12px', padding: '24px' }}>
            <h2>Baixar / Quitar Título</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              <strong>{settlingPayment.orderNumber}</strong> ({settlingPayment.type === 'receivable' ? 'Recebimento' : 'Pagamento'})
            </p>

            <form onSubmit={handleSettleSubmit}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                <label>
                  Valor da Baixa (R$)
                  <input
                    type="number"
                    step="0.01"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
                </label>

                <label>
                  Forma de Pagamento
                  <select value={settleMethod} onChange={(e) => setSettleMethod(e.target.value)}>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência Bancária</option>
                    <option value="boleto">Boleto</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn-calendar-nav" onClick={() => setSettlingPayment(null)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-action">
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatStatus(status: string) {
  switch (status) {
    case 'open': return 'Aberto';
    case 'partial': return 'Parcial';
    case 'overdue': return 'Vencido';
    case 'paid': return 'Pago';
    case 'cancelled': return 'Cancelado';
    default: return status;
  }
}

function getFilterLabel(filter: FilterCategory) {
  switch (filter) {
    case 'overdue': return 'Filtro: Vencidas';
    case 'dueToday': return 'Filtro: Vencem Hoje';
    case 'dueSoon': return 'Filtro: Próximos 3 Dias';
    case 'receivable': return 'Filtro: A Receber';
    case 'payable': return 'Filtro: A Pagar';
    default: return 'Todas';
  }
}

function formatLongDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
