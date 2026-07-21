'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../../../lib/api';
import './page.css';
import { useSearchParams } from 'next/navigation';

function LojaReportContent() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cliente' | 'produtor' | 'geral'>('cliente');
  const searchParams = useSearchParams();
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const customerId = searchParams.get('customerId');
  const producerId = searchParams.get('producerId');
  
  useEffect(() => {
    let url = '/dashboard/loja-pdf-data';
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    if (params.toString()) url += '?' + params.toString();
    
    apiGet(url).then((res: any) => {
      let fetched = res.data || res;
      if (customerId) {
        fetched = fetched.filter((s: any) => s.customerId?._id === customerId);
      }
      if (producerId) {
        if (producerId === 'agrovendas') {
          fetched = fetched.filter((s: any) => s.saleType === 'venda_estoque');
        } else {
          fetched = fetched.filter((s: any) => s.producerId?._id === producerId);
        }
      }
      
      // Sort data by Date as default, or by Customer
      fetched.sort((a: any, b: any) => {
        const nameA = String(viewMode === 'cliente' ? (a.customerName || '') : (a.producerName || ''));
        const nameB = String(viewMode === 'cliente' ? (b.customerName || '') : (b.producerName || ''));
        return nameA.localeCompare(nameB);
      });
      setData(fetched);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [start, end, viewMode, customerId, producerId]);

  const visibleData = useMemo(() => {
    if (viewMode === 'produtor') {
      if (producerId === 'agrovendas') {
        return data.filter(s => s.saleType === 'venda_estoque');
      }
      return data.filter(s => s.saleType !== 'venda_estoque');
    }
    return data;
  }, [data, viewMode, producerId]);

  const uniqueProducts = useMemo(() => {
    const productsSet = new Set<string>();
    visibleData.forEach((s) => {
      (s.items || []).forEach((item: any) => {
        if (item.productId?.name) {
          productsSet.add(item.productId.name);
        }
      });
    });
    return Array.from(productsSet).sort();
  }, [visibleData]);

  if (loading) {
    return <div style={{padding: '2rem'}}>Carregando relatório...</div>;
  }

  const getGrossAmount = (s: any) => {
    if (viewMode === 'produtor') {
      if (s.saleType === 'compra_venda' || s.saleType === 'particular') {
        return s.totalCostAmount ?? s.totalParticularAmount ?? 0;
      }
      if (s.saleType === 'intermediacao') {
        return s.totalParticularAmount ?? 0; // Mostrar o volume total negociado pelo produtor na intermediação
      }
      return 0;
    }
    return s.totalParticularAmount ?? 0;
  };

  const getNetAmount = (s: any) => {
    if (s.saleType === 'intermediacao') {
      if (viewMode === 'produtor') return 0;
      return s.brokerageAmount || 0; // Receber apenas a comissão
    }
    if (viewMode === 'produtor') {
      return s.producerNetAmount ?? 0;
    }
    return s.totalReceivableAmount ?? 0;
  };

  const getRecebidoAmount = (s: any) => {
    if (viewMode === 'produtor') {
      return s.pagoProdutor ?? 0;
    }
    return s.recebido ?? 0;
  };

  const getSaldoAmount = (s: any) => {
    if (viewMode === 'produtor') {
      return s.saldoProdutor ?? 0;
    }
    return s.saldo ?? 0;
  };

  const getFunruralAmount = (s: any) => {
    if (s.saleType === 'intermediacao') {
      return 0; // Corretora não retém Funrural de comissão
    }
    if (viewMode === 'produtor') {
      if (s.saleType === 'compra_venda') {
        return Math.max(0, (s.totalCostAmount || 0) - (s.producerNetAmount || 0));
      }
      return s.funruralRetentionAmount || 0;
    }
    return s.funruralRetentionAmount || 0;
  };


  // Common Totals
  const totalVendas = visibleData.length;
  const totalSacos = visibleData.reduce((acc, s) => acc + (s.totalBags || 0), 0);
  const totalKg = visibleData.reduce((acc, s) => acc + (s.totalKg || 0), 0);
  const totalParticular = visibleData.reduce((acc, s) => acc + getGrossAmount(s), 0);
  const totalReceber = visibleData.reduce((acc, s) => acc + getNetAmount(s), 0);
  const totalPagar = visibleData.reduce((acc, s) => {
    if (s.saleType === 'intermediacao' || s.saleType === 'venda_estoque') return acc;
    return acc + (s.producerNetAmount || 0);
  }, 0);
  const totalFunrural = visibleData.reduce((acc, s) => acc + getFunruralAmount(s), 0);
  const totalNFe = visibleData.reduce((acc, s) => acc + (s.nfeValue || 0), 0);
  const totalRecebido = visibleData.reduce((acc, s) => acc + getRecebidoAmount(s), 0);
  const totalSaldo = visibleData.reduce((acc, s) => acc + getSaldoAmount(s), 0);
  
  const getLucro = (s: any) => {
    if (s.saleType === 'particular') {
      return 0; // Repasse direto não gera margem nem lucro
    }
    if (s.saleType === 'intermediacao') {
      return s.brokerageAmount || 0; // Lucro é apenas a comissão
    }
    return (s.marginAmount || 0) + (s.brokerageAmount || 0);
  };

  const totalCorretagem = visibleData.reduce((acc, s) => acc + (s.brokerageAmount || 0), 0);
  const totalLucro = visibleData.reduce((acc, s) => acc + getLucro(s), 0);
  
  // Entities count
  const entities = new Set(visibleData.map(s => viewMode === 'cliente' ? s.customerName : s.producerName));
  
  function money(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  
  function formatDate(iso: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }


  const getProductCellData = (sale: any, productName: string) => {
    const items = sale.items || [];
    const matchedItems = items.filter((item: any) => item.productId?.name === productName);
    if (matchedItems.length === 0) return '-';

    const totalQty = matchedItems.reduce((sum: number, item: any) => sum + (item.quantityBags || 0), 0);
    const prices = matchedItems.map((item: any) => {
      const price = (viewMode === 'produtor' && sale.saleType === 'compra_venda' && item.costPerBag) 
        ? item.costPerBag 
        : (item.pricePerBag || 0);
      return money(price);
    });
    
    const uniquePrices = Array.from(new Set(prices)).join(' / ');
    const unit = matchedItems[0]?.productId?.defaultUnit || 'sc';

    return `${totalQty} ${unit} (${uniquePrices})`;
  };

  const getProductTotalQty = (productName: string) => {
    return visibleData.reduce((sum, s) => {
      const matchedItems = (s.items || []).filter((item: any) => item.productId?.name === productName);
      return sum + matchedItems.reduce((itemSum: number, item: any) => itemSum + (item.quantityBags || 0), 0);
    }, 0);
  };

  const headerBgColor = viewMode === 'cliente' ? '#2e7d32' : (viewMode === 'produtor' ? '#0d47a1' : '#4a148c');

  return (
    <div className="loja-report-wrapper">
      <div className="print-controls" style={{ gap: '1rem', marginBottom: '2rem' }}>
        <button 
           className={`print-btn ${viewMode === 'cliente' ? '' : 'inactive'}`} 
           style={{background: viewMode === 'cliente' ? '#2e7d32' : '#cfd8dc', color: viewMode === 'cliente' ? '#fff' : '#333'}}
           onClick={() => setViewMode('cliente')}
        >
          Visão Destinatário (Cliente)
        </button>
        <button 
           className={`print-btn ${viewMode === 'produtor' ? '' : 'inactive'}`} 
           style={{background: viewMode === 'produtor' ? '#0d47a1' : '#cfd8dc', color: viewMode === 'produtor' ? '#fff' : '#333'}}
           onClick={() => setViewMode('produtor')}
        >
          Visão Produtor (Detalhada)
        </button>
        <button 
           className={`print-btn ${viewMode === 'geral' ? '' : 'inactive'}`} 
           style={{background: viewMode === 'geral' ? '#4a148c' : '#cfd8dc', color: viewMode === 'geral' ? '#fff' : '#333'}}
           onClick={() => setViewMode('geral')}
        >
          Visão Geral (Completa)
        </button>
        
        <div style={{flexGrow: 1}}></div>
        
        <button className="print-btn" onClick={() => window.print()}>Imprimir PDF</button>
        <Link href="/relatorios" className="back-btn">Voltar</Link>
      </div>

      <header className="loja-header" style={{background: headerBgColor}}>
        <h1>AgroVendas - Relatório Final</h1>
        <span>Exportação: {viewMode === 'cliente' ? 'Loja por Loja' : (viewMode === 'produtor' ? 'Produtor' : 'Geral')}</span>
      </header>

      <div className="loja-title">
        <h2 style={{color: headerBgColor}}>
          Relatório Final - {viewMode === 'cliente' ? 'Loja por Loja' : (viewMode === 'produtor' ? 'Visão do Produtor' : 'Visão Geral (Interna)')}
        </h2>
        <p>
          {viewMode === 'cliente' 
            ? 'Modelo revisado para leitura rápida, com as vendas listadas para o destinatário'
            : (viewMode === 'produtor' 
                ? 'Modelo detalhado, com abertura de preço unitário e tipo de café (Espelho da Planilha)' 
                : 'Modelo completo, contendo todas as métricas financeiras, incluindo corretagem e lucro líquido.')}
        </p>
      </div>

      <div className="loja-params">
        <span>Venda: <strong>Geral</strong></span>
        <span>Período: <strong>{start ? formatDate(start) : 'Sempre'} até {end ? formatDate(end) : 'Sempre'}</strong></span>
        <span>Unidade: <strong>Saco</strong></span>
        <span>Conversão: <strong>1 saco = 25 kg</strong></span>
        <span>FUNRURAL: <strong>1,63%</strong></span>
      </div>

      <div className="executive-summary" style={{ gridTemplateColumns: viewMode === 'geral' ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)' }}>
        <div className="summary-card bg-green">
          <strong>{totalVendas}</strong>
          <span>Vendas</span>
        </div>
        <div className="summary-card bg-green">
          <strong>{totalSacos.toLocaleString('pt-BR')}</strong>
          <span>Total de sacos</span>
        </div>
        <div className="summary-card bg-green">
          <strong>{totalKg.toLocaleString('pt-BR')}</strong>
          <span>Total em kg</span>
        </div>
        <div className="summary-card bg-yellow">
          <strong>{money(totalParticular)}</strong>
          <span>Valor Bruto Total</span>
        </div>
        <div className="summary-card bg-yellow">
          <strong>{money(viewMode === 'produtor' ? totalPagar : totalReceber)}</strong>
          <span>{viewMode === 'produtor' ? 'Total a Pagar' : 'Total a Receber'}</span>
        </div>
        {viewMode === 'geral' && (
          <div className="summary-card bg-pink">
            <strong>{money(totalPagar)}</strong>
            <span>Total a Pagar</span>
          </div>
        )}
        
        {viewMode === 'geral' && (
          <div className="summary-card bg-pink">
            <strong>{money(totalFunrural)}</strong>
            <span>FUNRURAL</span>
          </div>
        )}
        <div className="summary-card bg-blue">
          <strong>{money(totalNFe)}</strong>
          <span>Valor NFe's</span>
        </div>
        <div className="summary-card bg-gray">
          <strong>{money(totalRecebido)}</strong>
          <span>Recebido</span>
        </div>
        <div className="summary-card bg-pink">
          <strong>{money(totalSaldo)}</strong>
          <span>Saldo em aberto</span>
        </div>
        <div className="summary-card bg-gray">
          <strong>{entities.size}</strong>
          <span>{viewMode === 'cliente' ? 'Destinatários' : 'Produtores'}</span>
        </div>

        {viewMode === 'geral' && (
          <>
            <div className="summary-card" style={{backgroundColor: '#b39ddb', borderColor: '#9575cd'}}>
              <strong>{money(totalLucro)}</strong>
              <span>Lucro Líquido</span>
            </div>
          </>
        )}
      </div>

      <h3 className="section-title" style={{borderColor: headerBgColor, color: headerBgColor}}>
        Detalhamento Geral
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table className="loja-table" style={{ minWidth: uniqueProducts.length > 0 ? `${1000 + uniqueProducts.length * 150}px` : '1000px' }}>
          <thead className="header-green" style={{background: headerBgColor}}>
            <tr>
              <th>Part.</th>
              <th>Data</th>
              {viewMode !== 'cliente' && <th>Produtor</th>}
              {viewMode !== 'produtor' && <th>Destinatário</th>}
              
              {uniqueProducts.map((prodName) => (
                <th key={prodName} style={{background: '#c8e6c9', color: '#333', whiteSpace: 'nowrap'}}>
                  {prodName}
                </th>
              ))}

              {viewMode === 'cliente' && <th>Total Sacos</th>}
              {viewMode === 'cliente' && <th>Kg</th>}
              
              <th>{viewMode === 'produtor' ? 'Valor venda' : 'Bruto Venda'}</th>
              <th>{viewMode === 'produtor' ? 'Líq. a Pagar' : 'Líq. a Receber'}</th>
              {viewMode === 'geral' && <th>Venc. Receber</th>}
              {viewMode === 'geral' && <th style={{background: '#ffcdd2', color: '#333'}}>Líq. a Pagar</th>}
              {viewMode === 'geral' && <th style={{background: '#ffcdd2', color: '#333'}}>Venc. Pagar</th>}
              {viewMode === 'produtor' && <th>Vencimento</th>}
              {viewMode === 'geral' && <th>FUNRURAL</th>}
              <th>Valor NFe's</th>

              {viewMode === 'geral' && <th style={{background: '#b39ddb', color: '#333'}}>Lucro Líquido</th>}

              {(viewMode === 'cliente' || viewMode === 'geral') && <th>Recebido</th>}
              {viewMode === 'cliente' && <th>Vencimento</th>}
              {(viewMode === 'cliente' || viewMode === 'geral') && <th>Status</th>}
            </tr>
          </thead>
          <tbody>
            {visibleData.map(s => {
              return (
                <tr key={s._id}>
                  <td>{s.orderNumber}</td>
                  <td style={{whiteSpace: 'nowrap'}}>{formatDate(s.date)}</td>
                  {viewMode !== 'cliente' && <td style={{textAlign: 'left'}}>{s.producerName}</td>}
                  {viewMode !== 'produtor' && <td style={{textAlign: 'left'}}>{s.customerName}</td>}
                  
                  {uniqueProducts.map((prodName) => (
                    <td key={prodName} style={{whiteSpace: 'nowrap'}}>
                      {getProductCellData(s, prodName)}
                    </td>
                  ))}
                  
                  {viewMode === 'cliente' && <td>{s.totalBags}</td>}
                  {viewMode === 'cliente' && <td>{s.totalKg}</td>}
                  
                  <td>{money(getGrossAmount(s))}</td>
                  <td>{money(getNetAmount(s))}</td>
                  {viewMode === 'geral' && <td>{formatDate(s.dueDate)}</td>}
                  {viewMode === 'geral' && <td>{money(s.producerNetAmount || 0)}</td>}
                  {viewMode === 'geral' && <td>{s.saleType === 'venda_estoque' ? '-' : formatDate(s.producerDueDate || s.dueDate)}</td>}
                  {viewMode === 'produtor' && <td>{s.saleType === 'venda_estoque' ? '-' : formatDate(s.producerDueDate || s.dueDate)}</td>}
                  {viewMode === 'geral' && <td>{money(getFunruralAmount(s))}</td>}
                  <td>{money(s.nfeValue)}</td>

                  {viewMode === 'geral' && <td style={{fontWeight: 'bold', color: getLucro(s) < 0 ? 'red' : 'green'}}>{money(getLucro(s))}</td>}

                  {(viewMode === 'cliente' || viewMode === 'geral') && <td>{money(getRecebidoAmount(s))}</td>}
                  {viewMode === 'cliente' && <td>{formatDate(s.dueDate)}</td>}
                  {(viewMode === 'cliente' || viewMode === 'geral') && <td>{getSaldoAmount(s) > 0 ? 'Em aberto' : 'Pago'}</td>}
                </tr>
              )
            })}
            
            {/* Linha de Totais Finais */}
            <tr className="totals-row">
              <td colSpan={viewMode === 'geral' ? 4 : 3}>TOTAL</td>
              
              {uniqueProducts.map((prodName) => {
                const qty = getProductTotalQty(prodName);
                return (
                  <td key={prodName} style={{fontWeight: 'bold'}}>
                    {qty > 0 ? `${qty}` : '-'}
                  </td>
                );
              })}

              {viewMode === 'cliente' && <td>{totalSacos}</td>}
              {viewMode === 'cliente' && <td>{totalKg}</td>}
              
              <td>{money(totalParticular)}</td>
              <td>{money(totalReceber)}</td>
              {viewMode === 'geral' && <td></td>}
              {viewMode === 'geral' && <td>{money(totalPagar)}</td>}
              {viewMode === 'geral' && <td></td>}
              {viewMode === 'produtor' && <td></td>}
              {viewMode === 'geral' && <td>{money(totalFunrural)}</td>}
              <td>{money(totalNFe)}</td>

              {viewMode === 'geral' && <td style={{fontWeight: 'bold', color: totalLucro < 0 ? 'red' : 'green'}}>{money(totalLucro)}</td>}

              {(viewMode === 'cliente' || viewMode === 'geral') && <td>{money(totalRecebido)}</td>}
              {viewMode === 'cliente' && <td></td>}
              {(viewMode === 'cliente' || viewMode === 'geral') && <td></td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LojaReportPage() {
  return (
    <Suspense fallback={<div style={{padding: '2rem'}}>Carregando página...</div>}>
      <LojaReportContent />
    </Suspense>
  );
}
