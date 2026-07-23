'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../../../lib/api';
import './page.css';
import { useSearchParams } from 'next/navigation';

function LojaReportContent() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [viewMode, setViewMode] = useState<'cliente' | 'produtor' | 'geral'>(() => {
    if (typeof window !== 'undefined') {
      const mode = new URLSearchParams(window.location.search).get('viewMode');
      if (mode === 'cliente' || mode === 'produtor' || mode === 'geral') {
        return mode;
      }
    }
    return 'cliente';
  });
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
    return s.totalParticularAmount ?? 0;
  };

  const getNetAmount = (s: any) => {
    // Na visão do produtor e do cliente, o líquido deve ser o bruto descontado do FUNRURAL
    if (viewMode === 'produtor' || viewMode === 'cliente') {
      return (s.totalParticularAmount ?? 0) - (s.funruralRetentionAmount ?? 0);
    }
    return s.totalReceivableAmount ?? 0;
  };

  const getRecebidoAmount = (s: any) => {
    // Na visão do produtor e do cliente, o recebido deve refletir a proporção do valor bruto recebido
    if (viewMode === 'produtor' || viewMode === 'cliente') {
      const totalAmt = s.totalParticularAmount || 0;
      if (totalAmt > 0) {
        const ratio = (s.recebido || 0) / totalAmt;
        return ((s.totalParticularAmount || 0) - (s.funruralRetentionAmount || 0)) * ratio;
      }
      return 0;
    }
    return s.recebido ?? 0;
  };

  const getSaldoAmount = (s: any) => {
    // Na visão do produtor e do cliente, o saldo deve refletir a proporção do saldo restante
    if (viewMode === 'produtor' || viewMode === 'cliente') {
      const totalAmt = s.totalParticularAmount || 0;
      if (totalAmt > 0) {
        const ratio = (s.saldo || 0) / totalAmt;
        return ((s.totalParticularAmount || 0) - (s.funruralRetentionAmount || 0)) * ratio;
      }
      return 0;
    }
    return s.saldo ?? 0;
  };

  const getFunruralAmount = (s: any) => {
    return s.funruralRetentionAmount ?? 0;
  };

  const getProducerNetAmount = (s: any) => {
    if (s.saleType === 'intermediacao' || s.saleType === 'venda_estoque') return 0;
    
    // Na visão do produtor, se for compra_venda, o líquido deve ter o desconto do FUNRURAL
    if (viewMode === 'produtor' && s.saleType === 'compra_venda') {
      const cost = s.totalCostAmount ?? s.producerNetAmount ?? 0;
      const funrural = cost * (s.funruralRate ?? 0.0163);
      return cost - funrural;
    }
    
    return s.producerNetAmount || 0;
  };

  // Common Totals
  const totalVendas = visibleData.length;
  const totalSacos = visibleData.reduce((acc, s) => acc + (s.totalBags || 0), 0);
  const totalKg = visibleData.reduce((acc, s) => acc + (s.totalKg || 0), 0);
  const totalParticular = visibleData.reduce((acc, s) => acc + getGrossAmount(s), 0);
  const totalReceber = visibleData.reduce((acc, s) => acc + getNetAmount(s), 0);
  const totalPagar = visibleData.reduce((acc, s) => {
    return acc + getProducerNetAmount(s);
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

  const changeViewMode = (mode: 'cliente' | 'produtor' | 'geral') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('viewMode', mode);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const loadHtml2Pdf = () => {
    return new Promise<any>((resolve, reject) => {
      if (typeof window === 'undefined') return reject('Window undefined');
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve((window as any).html2pdf);
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  const handleShareWhatsApp = async () => {
    if (sharing) return;
    setSharing(true);
    
    const dateText = (start && end) ? `de ${formatDate(start)} a ${formatDate(end)}` : '';
    const modeText = viewMode === 'cliente' ? 'Cliente' : (viewMode === 'produtor' ? 'Produtor' : 'Geral');
    const textMsg = `Seguem os Relatórios de Venda - Visão ${modeText} ${dateText}.\n\nPara acessar online:\n${window.location.href}`;
    const filename = `Relatorio_${modeText}_${start || ''}_${end || ''}.pdf`;

    try {
      const html2pdf = await loadHtml2Pdf();
      const element = document.querySelector('.loja-report-wrapper');
      
      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      // Generate the PDF as a Blob
      const pdfBlob = await html2pdf().from(element).set(opt).outputPdf('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      // If Web Share is supported and has file sharing capacity
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Relatório - ${modeText}`,
          text: textMsg
        });
      } else {
        // Fallback: trigger file download + open WhatsApp
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const deviceName = isMobile ? 'celular' : 'computador';
        const folderName = isMobile ? 'Arquivos / Downloads' : 'Downloads';

        // Open WhatsApp with text link instructions
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg + `\n\n(O arquivo PDF foi baixado em seu ${deviceName}. Anexe o PDF da pasta ${folderName} na conversa do WhatsApp)`)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error('Falha ao gerar ou compartilhar o PDF', err);
      // Fallback simple: just open WhatsApp text link
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
      window.open(whatsappUrl, '_blank');
    } finally {
      setSharing(false);
    }
  };


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
      <div className="print-controls" data-html2canvas-ignore="true" style={{ gap: '1rem', marginBottom: '2rem' }}>
        <button 
           className={`print-btn ${viewMode === 'cliente' ? '' : 'inactive'}`} 
           style={{background: viewMode === 'cliente' ? '#2e7d32' : '#cfd8dc', color: viewMode === 'cliente' ? '#fff' : '#333'}}
           onClick={() => changeViewMode('cliente')}
        >
          Cliente
        </button>
        <button 
           className={`print-btn ${viewMode === 'produtor' ? '' : 'inactive'}`} 
           style={{background: viewMode === 'produtor' ? '#0d47a1' : '#cfd8dc', color: viewMode === 'produtor' ? '#fff' : '#333'}}
           onClick={() => changeViewMode('produtor')}
        >
          Produtor
        </button>
        <button 
           className={`print-btn ${viewMode === 'geral' ? '' : 'inactive'}`} 
           style={{background: viewMode === 'geral' ? '#4a148c' : '#cfd8dc', color: viewMode === 'geral' ? '#fff' : '#333'}}
           onClick={() => changeViewMode('geral')}
        >
          Geral
        </button>
        
        <div style={{flexGrow: 1}}></div>
        
        <button className="print-btn" style={{background: '#25d366', color: '#fff'}} onClick={handleShareWhatsApp}>
          {sharing ? '⏳ Gerando...' : '🟢 WhatsApp'}
        </button>
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



      <div className="executive-summary cols-6">
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
          <strong>{money(totalReceber)}</strong>
          <span>{viewMode === 'cliente' ? 'Total a Pagar' : 'Total a Receber'}</span>
        </div>
        {viewMode === 'geral' && (
          <div className="summary-card bg-pink">
            <strong>{money(totalPagar)}</strong>
            <span>Total a Pagar</span>
          </div>
        )}
        <div className="summary-card bg-pink">
          <strong>{money(totalFunrural)}</strong>
          <span>FUNRURAL</span>
        </div>
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
              <th>Destinatário</th>
              
              {uniqueProducts.map((prodName) => (
                <th key={prodName} style={{background: '#c8e6c9', color: '#333', whiteSpace: 'nowrap'}}>
                  {prodName}
                </th>
              ))}
              
              <th>Bruto Venda</th>
              <th>{viewMode === 'cliente' ? 'Líq. a Pagar' : 'Líq. a Receber'}</th>
              <th>Venc. Receber</th>
              {viewMode === 'geral' && <th style={{background: '#ffcdd2', color: '#333'}}>Líq. a Pagar</th>}
              {viewMode === 'geral' && <th style={{background: '#ffcdd2', color: '#333'}}>Venc. Pagar</th>}
              <th>FUNRURAL</th>
              <th>Valor NFe's</th>
 
              {viewMode === 'geral' && <th style={{background: '#b39ddb', color: '#333'}}>Lucro Líquido</th>}
 
              <th>Recebido</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleData.map(s => {
              return (
                <tr key={s._id}>
                  <td>{s.orderNumber}</td>
                  <td style={{whiteSpace: 'nowrap'}}>{formatDate(s.date)}</td>
                  {viewMode !== 'cliente' && <td style={{textAlign: 'left'}}>{s.producerName}</td>}
                  <td style={{textAlign: 'left'}}>{s.customerName}</td>
                  
                  {uniqueProducts.map((prodName) => (
                    <td key={prodName} style={{whiteSpace: 'nowrap'}}>
                      {getProductCellData(s, prodName)}
                    </td>
                  ))}
                  
                  <td>{money(getGrossAmount(s))}</td>
                  <td>{money(getNetAmount(s))}</td>
                  <td>{formatDate(s.dueDate)}</td>
                  {viewMode === 'geral' && <td>{money(getProducerNetAmount(s))}</td>}
                  {viewMode === 'geral' && <td>{s.saleType === 'venda_estoque' ? '-' : formatDate(s.producerDueDate || s.dueDate)}</td>}
                  <td>{money(getFunruralAmount(s))}</td>
                  <td>{money(s.nfeValue)}</td>
 
                  {viewMode === 'geral' && <td style={{fontWeight: 'bold', color: getLucro(s) < 0 ? 'red' : 'green'}}>{money(getLucro(s))}</td>}
 
                  <td>{money(getRecebidoAmount(s))}</td>
                  <td>{getSaldoAmount(s) > 0 ? 'Em aberto' : 'Pago'}</td>
                </tr>
              )
            })}
            
            {/* Linha de Totais Finais */}
            <tr className="totals-row">
              <td colSpan={viewMode === 'cliente' ? 3 : 4}>TOTAL</td>
              
              {uniqueProducts.map((prodName) => {
                const qty = getProductTotalQty(prodName);
                return (
                  <td key={prodName} style={{fontWeight: 'bold'}}>
                    {qty > 0 ? `${qty}` : '-'}
                  </td>
                );
              })}
              
              <td>{money(totalParticular)}</td>
              <td>{money(totalReceber)}</td>
              <td></td>
              {viewMode === 'geral' && <td>{money(totalPagar)}</td>}
              {viewMode === 'geral' && <td></td>}
              <td>{money(totalFunrural)}</td>
              <td>{money(totalNFe)}</td>
 
              {viewMode === 'geral' && <td style={{fontWeight: 'bold', color: totalLucro < 0 ? 'red' : 'green'}}>{money(totalLucro)}</td>}
 
              <td>{money(totalRecebido)}</td>
              <td></td>
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
