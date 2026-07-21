import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles.css';

export const metadata: Metadata = {
  title: 'AgroVenda Broker',
  description: 'Backoffice operacional e agenda de vencimentos.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AgroAgenda',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
