'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../../lib/api';

type Customer = { _id?: string; name?: string; whatsapp?: string };
type Producer = { _id?: string; name?: string };
type SalesOrder = { _id?: string; orderNumber?: string; date?: string };

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
  producerId?: string | Producer;
  producerName?: string;
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

export default function ReceivableDetailPage() {
  const params = useParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) {
      return;
    }
    apiGet<Payment>(`/payments/${params.id}`)
      .then(setPayment)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar conta a receber.'));
  }, [params.id]);

  if (error) {
    return (
      <main className="shell">
        <p><Link href="/financeiro/receber">Voltar</Link></p>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="shell">
        <p><Link href="/financeiro/receber">Voltar</Link></p>
        <p className="empty">Carregando conta a receber...</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/financeiro/receber">Contas a Receber</Link></p>
          <h1>Conta da venda {payment.orderNumber}</h1>
        </div>
        <span className="status-pill">{paymentStatusLabel(payment.status)}</span>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Valor</span>
          <strong>{money(payment.amount)}</strong>
        </article>
        <article className="summary-card">
          <span>Pago</span>
          <strong>{money(payment.paidAmount)}</strong>
        </article>
        <article className="summary-card">
          <span>Saldo</span>
          <strong>{money(payment.balanceAmount)}</strong>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel form-section">
          <h2>Dados da conta</h2>
          <dl>
            <dt>Venda</dt><dd>{payment.orderNumber}</dd>
            <dt>Cliente</dt><dd>{getCustomerName(payment)}</dd>
            <dt>Produtor</dt><dd>{getProducerName(payment)}</dd>
            <dt>Vencimento</dt><dd>{formatDate(payment.dueDate)}</dd>
            <dt>Método</dt><dd>{payment.method ?? '-'}</dd>
          </dl>
        </article>

        <article className="panel form-section">
          <h2>Ações</h2>
          <div className="toolbar">
            <Link className="link-action" href={`/vendas/${getSalesOrderId(payment)}`}>Ver venda</Link>
            <Link className="link-action" href={`/fiscal?orderNumber=${encodeURIComponent(payment.orderNumber)}`}>Ver nota</Link>
            {buildWhatsappHref(payment) ? (
              <a className="link-action" href={buildWhatsappHref(payment)} target="_blank" rel="noreferrer">Cobrar via WhatsApp</a>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel form-section">
        <h2>Histórico de baixas</h2>
        <div className="table">
          <div className="table-row history-table-head">
            <span>Data</span>
            <span>Valor</span>
            <span>Método</span>
            <span>Observações</span>
          </div>
          {(payment.history ?? []).map((entry, index) => (
            <div className="table-row history-table-row" key={`${entry.paidAt}-${index}`}>
              <span>{formatDate(entry.paidAt)}</span>
              <span>{money(entry.amount)}</span>
              <span>{entry.method ?? '-'}</span>
              <span>{entry.notes ?? '-'}</span>
            </div>
          ))}
          {payment.history?.length ? null : <p className="empty">Nenhuma baixa registrada.</p>}
        </div>
      </section>
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

function getProducerName(payment: Payment) {
  if (typeof payment.producerId === 'object' && payment.producerId?.name) {
    return payment.producerId.name;
  }
  return payment.producerName ?? '-';
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
