'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet } from '../../../lib/api';

type Payment = {
  _id: string;
  orderNumber: string;
  type: 'payable' | 'receivable';
  amount: number;
  balanceAmount: number;
  dueDate: string;
  status: string;
  customerName?: string;
  producerName?: string;
};

export default function CashFlowPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    apiGet<Payment[]>('/payments').then(setPayments).catch(() => setPayments([]));
  }, []);

  const receivables = payments.filter((p) => p.type === 'receivable');
  const payables = payments.filter((p) => p.type === 'payable');

  // Pair up payments by orderNumber for easy tracking
  const orders = Array.from(new Set(payments.map(p => p.orderNumber)));

  return (
    <main className="shell">
      <section className="header compact">
        <p><Link href="/">Inicio</Link> / <Link href="/financeiro">Financeiro</Link></p>
        <h1>Fluxo de Caixa (Pareamento por Negócio)</h1>
      </section>

      <section className="panel">
        <p>Acompanhe os recebimentos dos clientes e os pagamentos aos produtores para garantir o fluxo de caixa nas operações de Revenda.</p>
        <div className="table" style={{ marginTop: '20px' }}>
          <div className="table-row table-head" style={{ gridTemplateColumns: '1fr 2fr 1fr 2fr' }}>
            <span>Pedido</span>
            <span>A Receber (Cliente)</span>
            <span>Margem</span>
            <span>A Pagar (Produtor)</span>
          </div>
          {orders.map((orderNum) => {
            const orderRecs = receivables.filter(r => r.orderNumber.startsWith(orderNum));
            const orderPays = payables.filter(p => p.orderNumber.startsWith(orderNum));
            
            const totalRec = orderRecs.reduce((acc, curr) => acc + curr.amount, 0);
            const totalPay = orderPays.reduce((acc, curr) => acc + curr.amount, 0);
            const margin = totalRec - totalPay;

            return (
              <div className="table-row" style={{ gridTemplateColumns: '1fr 2fr 1fr 2fr' }} key={orderNum}>
                <span><strong>{orderNum}</strong></span>
                <span style={{ color: 'green' }}>
                  {orderRecs.map(r => (
                    <div key={r._id}>
                      R$ {r.amount.toFixed(2)} ({r.status})<br/>
                      <small>Venc: {new Date(r.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {r.customerName || r.producerName}</small>
                    </div>
                  ))}
                  {orderRecs.length === 0 && '-'}
                </span>
                <span style={{ fontWeight: 'bold' }}>
                  {totalPay > 0 ? `R$ ${margin.toFixed(2)}` : 'Comissão'}
                </span>
                <span style={{ color: 'red' }}>
                  {orderPays.map(p => (
                    <div key={p._id}>
                      R$ {p.amount.toFixed(2)} ({p.status})<br/>
                      <small>Venc: {new Date(p.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {p.producerName}</small>
                    </div>
                  ))}
                  {orderPays.length === 0 && '-'}
                </span>
              </div>
            );
          })}
          {orders.length === 0 ? <p className="empty">Nenhum fluxo registrado.</p> : null}
        </div>
      </section>
    </main>
  );
}

