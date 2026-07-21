import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AgroVendas Agenda & Alertas',
    short_name: 'AgroAgenda',
    description: 'Agenda e Alertas de Vencimentos do AgroVenda Broker',
    start_url: '/agenda',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
