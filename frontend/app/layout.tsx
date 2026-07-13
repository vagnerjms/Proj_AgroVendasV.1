import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles.css';

export const metadata: Metadata = {
  title: 'AgroVenda Broker',
  description: 'Backoffice operacional para vendas de hortifruti.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme="colored" />
      </body>
    </html>
  );
}
