'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';

type Payment = {
  _id: string;
  orderNumber: string;
  customerName?: string;
  producerName?: string;
  dueDate: string;
  balanceAmount: number;
};

type FiscalDocument = {
  _id: string;
  orderNumber: string;
  number?: string;
  amount?: number;
  status: string;
};

type PaymentAlerts = {
  receivablesOverdue: Payment[];
  receivablesDueToday: Payment[];
  receivablesDueSoon: Payment[];
  payablesOverdue: Payment[];
  payablesDueToday: Payment[];
  payablesDueSoon: Payment[];
};

type FiscalAlerts = {
  pending: FiscalDocument[];
  divergent: FiscalDocument[];
};

export default function AlertsPage() {
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlerts>({
    receivablesOverdue: [],
    receivablesDueToday: [],
    receivablesDueSoon: [],
    payablesOverdue: [],
    payablesDueToday: [],
    payablesDueSoon: [],
  });
  const [fiscalAlerts, setFiscalAlerts] = useState<FiscalAlerts>({ pending: [], divergent: [] });

  useEffect(() => {
    void Promise.all([
      apiGet<PaymentAlerts>('/payments/alerts').then(setPaymentAlerts).catch(() => undefined),
      apiGet<FiscalAlerts>('/fiscal-documents/alerts').then(setFiscalAlerts).catch(() => undefined),
    ]);
  }, []);

  return (
    <main className="shell">
      <section className="header compact">
        <div>
          <p><Link href="/">Inicio</Link></p>
          <h1>Central de Alertas</h1>
        </div>
      </section>

      <section className="alerts-grid">
        <AlertBlock title="Contas a receber" groups={[
          ['Vencidas', paymentAlerts.receivablesOverdue, '/financeiro/receber'],
          ['Vencem hoje', paymentAlerts.receivablesDueToday, '/financeiro/receber'],
          ['Vencem em breve', paymentAlerts.receivablesDueSoon, '/financeiro/receber'],
        ]} />

        <AlertBlock title="Contas a pagar" groups={[
          ['Vencidas', paymentAlerts.payablesOverdue, '/financeiro/pagar'],
          ['Vencem hoje', paymentAlerts.payablesDueToday, '/financeiro/pagar'],
          ['Vencem em breve', paymentAlerts.payablesDueSoon, '/financeiro/pagar'],
        ]} />

        <section className="panel form-section">
          <h2>Fiscal</h2>
          <AlertList title="Notas pendentes" items={fiscalAlerts.pending.map((doc) => ({
            id: doc._id,
            label: `${doc.orderNumber} Â· NF ${doc.number ?? '-'}`,
            detail: money(doc.amount ?? 0),
            href: `/fiscal?orderNumber=${encodeURIComponent(doc.orderNumber)}`,
          }))} />
          <AlertList title="Notas divergentes" items={fiscalAlerts.divergent.map((doc) => ({
            id: doc._id,
            label: `${doc.orderNumber} Â· NF ${doc.number ?? '-'}`,
            detail: money(doc.amount ?? 0),
            href: `/fiscal?orderNumber=${encodeURIComponent(doc.orderNumber)}`,
          }))} />
        </section>
      </section>
    </main>
  );
}

function AlertBlock({ title, groups }: { title: string; groups: Array<[string, Payment[], string]> }) {
  return (
    <section className="panel form-section">
      <h2>{title}</h2>
      {groups.map(([groupTitle, payments, href]) => (
        <AlertList
          key={groupTitle}
          title={groupTitle}
          items={payments.map((payment) => ({
            id: payment._id,
            label: `${payment.orderNumber} Â· ${payment.customerName ?? payment.producerName ?? '-'}`,
            detail: `${formatDate(payment.dueDate)} Â· ${money(payment.balanceAmount)}`,
            href,
          }))}
        />
      ))}
    </section>
  );
}

function AlertList({ title, items }: { title: string; items: Array<{ id: string; label: string; detail: string; href: string }> }) {
  return (
    <div className="alert-list">
      <h3>{title}</h3>
      {items.map((item) => (
        <Link className="alert-item" href={item.href} key={item.id}>
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </Link>
      ))}
      {items.length === 0 ? <p className="empty">Sem alertas.</p> : null}
    </div>
  );
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
}

