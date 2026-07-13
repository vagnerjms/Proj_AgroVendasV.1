'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch } from '../../../lib/api';

type Producer = { _id?: string; name?: string };
type Customer = { _id?: string; name?: string };
type SalesOrder = { _id?: string; orderNumber?: string };

type Payment = {
  _id: string;
  salesOrderId: string | SalesOrder;
  orderNumber: string;
  producerId?: string | Producer;
  producerName?: string;
  customerId?: string | Customer;
  customerName?: string;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  status: 'open' | 'partial' | 'paid' | 'overdue' | 'cancelled';
};

type PaymentAlerts = {
  payablesOverdue: Payment[];
  payablesDueToday: Payment[];
  payablesDueSoon: Payment[];
};

const initialSettleForm = {
  amount: 0,
  paidAt: new Date().toISOString().slice(0, 10),
  method: 'pix',
  notes: '',
};

export default function PayablesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [alerts, setAlerts] = useState<PaymentAlerts>({ payablesOverdue: [], payablesDueToday: [], payablesDueSoon: [] });
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [settleForm, setSettleForm] = useState(initialSettleForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [paymentsResponse, alertsResponse] = await Promise.all([
      apiGet<Payment[]>('/payments?type=payable').catch(() => []),
      apiGet<PaymentAlerts>('/payments/alerts').catch(() => ({ payablesOverdue: [], payablesDueToday: [], payablesDueSoon: [] })),
    ]);
    setPayments(paymentsResponse);
    setAlerts(alertsResponse);
  }

  const totalOpen = useMemo(
    () =>
      payments
        .filter((payment) => ['open', 'partial', 'overdue'].includes(payment.status))
        .reduce((sum, payment) => sum + (payment.balanceAmount ?? 0), 0),
    [payments],
  );

  function openSettle(payment: Payment) {
    setSelectedPayment(payment);
    setSettleForm({ ...initialSettleForm, amount: payment.balanceAmount });
    setMessage('');
  }

  async function submitSettle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPayment) return;
    try {
      await apiPatch<Payment>(`/payments/${selectedPayment._id}/settle`, {
        ...settleForm,
        amount: Number(settleForm.amount),
      });
      setSelectedPayment(null);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao registrar pagamento.');
    }
  }

  async function cancelPayment(payment: Payment) {
    setMessage('');
    try {
      await apiPatch<Payment>(`/payments/${payment._id}/cancel`, { notes: 'Cancelada pela tela de contas a pagar.' });
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao cancelar conta.');
    }
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link></p>
          <h1>Contas a Pagar</h1>
        </div>
        <Link className="link-action" href="/financeiro/receber">Contas a receber</Link>
      </section>

      <section className="summary-grid">
        <article className="summary-card"><span>Total em aberto</span><strong>{money(totalOpen)}</strong></article>
        <article className="summary-card"><span>Vencidas</span><strong>{alerts.payablesOverdue.length}</strong></article>
        <article className="summary-card"><span>Vencem hoje</span><strong>{alerts.payablesDueToday.length}</strong></article>
        <article className="summary-card"><span>Vencem em 3 dias</span><strong>{alerts.payablesDueSoon.length}</strong></article>
      </section>

      <section className="panel">
        <div className="table">
          <div className="table-row payables-table-head">
            <span>Venda</span>
            <span>Produtor</span>
            <span>Cliente</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span>Pago</span>
            <span>Saldo</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {payments.map((payment) => (
            <div className="table-row payables-table-row" key={payment._id}>
              <span>{payment.orderNumber}</span>
              <span>{getProducerName(payment)}</span>
              <span>{getCustomerName(payment)}</span>
              <span>{formatDate(payment.dueDate)}</span>
              <span>{money(payment.amount)}</span>
              <span>{money(payment.paidAmount)}</span>
              <span>{money(payment.balanceAmount)}</span>
              <span>{paymentStatusLabel(payment.status)}</span>
              <span className="actions-cell">
                <Link className="link-action compact-action" href={`/vendas/${getSalesOrderId(payment)}`}>Ver venda</Link>
                <button className="link-action compact-action" type="button" onClick={() => openSettle(payment)} disabled={payment.status === 'paid' || payment.status === 'cancelled'}>Registrar pagamento</button>
                <button className="link-action compact-action" type="button" onClick={() => cancelPayment(payment)} disabled={payment.status === 'cancelled'}>Cancelar conta</button>
              </span>
            </div>
          ))}
          {payments.length === 0 ? <p className="empty">Nenhuma conta a pagar encontrada.</p> : null}
        </div>
      </section>

      {selectedPayment ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submitSettle}>
            <div className="modal-header">
              <h2>Registrar pagamento ao produtor</h2>
              <button type="button" onClick={() => setSelectedPayment(null)}>Fechar</button>
            </div>
            <p className="empty">Venda: <strong>{selectedPayment.orderNumber}</strong> · Saldo: <strong>{money(selectedPayment.balanceAmount)}</strong></p>
            <div className="form-grid">
              <label>Valor pago
                <input type="number" min="0.01" step="0.01" value={settleForm.amount} onChange={(event) => setSettleForm((current) => ({ ...current, amount: Number(event.target.value) }))} required />
              </label>
              <label>Data do pagamento
                <input type="date" value={settleForm.paidAt} onChange={(event) => setSettleForm((current) => ({ ...current, paidAt: event.target.value }))} />
              </label>
              <label>Método
                <input value={settleForm.method} onChange={(event) => setSettleForm((current) => ({ ...current, method: event.target.value }))} />
              </label>
              <label className="wide">Observações
                <textarea value={settleForm.notes} onChange={(event) => setSettleForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
            <button className="primary-action full" type="submit">Salvar pagamento</button>
            {message ? <p className="message">{message}</p> : null}
          </form>
        </div>
      ) : null}
    </main>
  );
}

function getSalesOrderId(payment: Payment) {
  return typeof payment.salesOrderId === 'string' ? payment.salesOrderId : payment.salesOrderId?._id ?? '';
}

function getProducerName(payment: Payment) {
  if (typeof payment.producerId === 'object' && payment.producerId?.name) return payment.producerId.name;
  return payment.producerName ?? '-';
}

function getCustomerName(payment: Payment) {
  if (typeof payment.customerId === 'object' && payment.customerId?.name) return payment.customerId.name;
  return payment.customerName ?? '-';
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    open: 'Aberta',
    partial: 'Parcial',
    paid: 'Paga',
    overdue: 'Vencida',
    cancelled: 'Cancelada',
  };
  return labels[status] ?? status;
}

