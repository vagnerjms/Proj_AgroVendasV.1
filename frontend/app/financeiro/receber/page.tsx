'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch } from '../../../lib/api';

type Customer = { _id?: string; name?: string; whatsapp?: string };
type SalesOrder = { _id?: string; orderNumber?: string };

type PaymentHistoryEntry = {
  amount: number;
  paidAt: string;
  method?: string;
  notes?: string;
  createdAt?: string;
};

type Payment = {
  _id: string;
  type: 'receivable' | 'payable';
  salesOrderId: string | SalesOrder;
  orderNumber: string;
  customerId?: string | Customer;
  customerName?: string;
  customerWhatsapp?: string;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  paidAt?: string;
  method?: string;
  status: 'open' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  history?: PaymentHistoryEntry[];
};

type PaymentAlerts = {
  overdue: Payment[];
  dueToday: Payment[];
  dueNext3Days: Payment[];
};

type FiscalDocument = {
  _id: string;
  orderNumber: string;
  status: string;
};

const initialSettleForm = {
  amount: 0,
  paidAt: new Date().toISOString().slice(0, 10),
  method: 'pix',
  notes: '',
};

export default function ReceivablesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [alerts, setAlerts] = useState<PaymentAlerts>({ overdue: [], dueToday: [], dueNext3Days: [] });
  const [fiscalDocuments, setFiscalDocuments] = useState<FiscalDocument[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [settleForm, setSettleForm] = useState(initialSettleForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [paymentsResponse, alertsResponse, fiscalResponse] = await Promise.all([
      apiGet<Payment[]>('/payments?type=receivable').catch(() => []),
      apiGet<PaymentAlerts>('/payments/alerts').catch(() => ({ overdue: [], dueToday: [], dueNext3Days: [] })),
      apiGet<FiscalDocument[]>('/fiscal-documents').catch(() => []),
    ]);
    setPayments(paymentsResponse);
    setAlerts(alertsResponse);
    setFiscalDocuments(fiscalResponse);
  }

  const openPayments = useMemo(
    () => payments.filter((payment) => ['open', 'partial', 'overdue'].includes(payment.status)),
    [payments],
  );

  const totalOpen = openPayments.reduce((sum, payment) => sum + (payment.balanceAmount ?? 0), 0);
  const fiscalByOrder = useMemo(() => new Map(fiscalDocuments.map((doc) => [doc.orderNumber, doc])), [fiscalDocuments]);

  function openSettle(payment: Payment) {
    setSelectedPayment(payment);
    setSettleForm({
      ...initialSettleForm,
      amount: payment.balanceAmount,
    });
    setMessage('');
  }

  async function submitSettle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPayment) {
      return;
    }

    setMessage('');
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

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link></p>
          <h1>Contas a Receber</h1>
        </div>
        <Link className="link-action" href="/vendas">Vendas</Link>
      </section>

      <section className="summary-grid" aria-label="Resumo financeiro">
        <article className="summary-card">
          <span>Vencidas</span>
          <strong>{alerts.overdue.length}</strong>
        </article>
        <article className="summary-card">
          <span>Vencem hoje</span>
          <strong>{alerts.dueToday.length}</strong>
        </article>
        <article className="summary-card">
          <span>Vencem em 3 dias</span>
          <strong>{alerts.dueNext3Days.length}</strong>
        </article>
        <article className="summary-card">
          <span>Total em aberto</span>
          <strong>{money(totalOpen)}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="table">
          <div className="table-row receivables-table-head">
            <span>Venda</span>
            <span>Cliente</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span>Pago</span>
            <span>Saldo</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {payments.map((payment) => {
            const fiscal = fiscalByOrder.get(payment.orderNumber);
            const whatsappHref = buildWhatsappHref(payment);
            return (
              <div className="table-row receivables-table-row" key={payment._id}>
                <span><Link href={`/financeiro/receber/${payment._id}`}>{payment.orderNumber}</Link></span>
                <span>{getCustomerName(payment)}</span>
                <span>{formatDate(payment.dueDate)}</span>
                <span>{money(payment.amount)}</span>
                <span>{money(payment.paidAmount)}</span>
                <span>{money(payment.balanceAmount)}</span>
                <span>{paymentStatusLabel(payment.status)}</span>
                <span className="actions-cell">
                  <Link className="link-action compact-action" href={`/vendas/${getSalesOrderId(payment)}`}>Ver venda</Link>
                  <Link className="link-action compact-action" href={`/fiscal?orderNumber=${encodeURIComponent(payment.orderNumber)}`}>
                    {fiscal ? 'Ver nota' : 'Buscar nota'}
                  </Link>
                  <button className="link-action compact-action" type="button" onClick={() => openSettle(payment)} disabled={payment.status === 'paid' || payment.status === 'cancelled'}>
                    Registrar pagamento
                  </button>
                  {whatsappHref ? (
                    <a className="link-action compact-action" href={whatsappHref} target="_blank" rel="noreferrer">Cobrar via WhatsApp</a>
                  ) : (
                    <button className="link-action compact-action" type="button" disabled>Cobrar via WhatsApp</button>
                  )}
                </span>
              </div>
            );
          })}
          {payments.length === 0 ? <p className="empty">Nenhuma conta a receber encontrada.</p> : null}
        </div>
      </section>

      {selectedPayment ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submitSettle}>
            <div className="modal-header">
              <h2>Registrar pagamento</h2>
              <button type="button" onClick={() => setSelectedPayment(null)}>Fechar</button>
            </div>
            <p className="empty">Venda: <strong>{selectedPayment.orderNumber}</strong> · Saldo: <strong>{money(selectedPayment.balanceAmount)}</strong></p>
            <div className="form-grid">
              <label>Valor pago
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={settleForm.amount}
                  onChange={(event) => setSettleForm((current) => ({ ...current, amount: Number(event.target.value) }))}
                  required
                />
              </label>
              <label>Data do pagamento
                <input
                  type="date"
                  value={settleForm.paidAt}
                  onChange={(event) => setSettleForm((current) => ({ ...current, paidAt: event.target.value }))}
                />
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

function getCustomerName(payment: Payment) {
  if (typeof payment.customerId === 'object' && payment.customerId?.name) {
    return payment.customerId.name;
  }
  return payment.customerName ?? '-';
}

function getCustomerWhatsapp(payment: Payment) {
  if (typeof payment.customerId === 'object' && payment.customerId?.whatsapp) {
    return payment.customerId.whatsapp;
  }
  return payment.customerWhatsapp;
}

function buildWhatsappHref(payment: Payment) {
  const phone = getCustomerWhatsapp(payment)?.replace(/\D/g, '');
  if (!phone) {
    return '';
  }
  const message = `Olá, tudo bem? Estou entrando em contato sobre a venda ${payment.orderNumber}, com vencimento em ${formatDate(payment.dueDate)}, no valor de ${money(payment.balanceAmount)}. Poderia verificar, por favor?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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

