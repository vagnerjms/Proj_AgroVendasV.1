import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { SalesOrderDocument } from './schemas/sales-order.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  async generateContract(order: SalesOrderDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Simple Layout
        doc.fontSize(20).text('AGRO VENDAS', { align: 'center' });
        doc.moveDown();

        if (order.saleType === 'intermediacao') {
          doc.fontSize(16).text('CONTRATO DE INTERMEDIAÇÃO', { align: 'center' });
          doc.moveDown();
          doc.fontSize(12).text(`Número do Pedido: ${order.orderNumber}`);
          doc.text(`Data: ${new Date(order.date).toLocaleDateString('pt-BR')}`);
          doc.moveDown();
          doc.text(`Produtor: ${this.getEntityName(order.producerId)}`);
          doc.text(`Cliente: ${this.getEntityName(order.customerId)}`);
          doc.moveDown();
          doc.text(`Quantidade Total (Bags): ${order.totalBags}`);
          doc.text(`Total da Operação: R$ ${order.totalReceivableAmount.toFixed(2)}`);
          doc.text(`Comissão (Corretagem): R$ ${(order.brokerageAmount || 0).toFixed(2)}`);
        } else if (order.saleType === 'compra_venda') {
          doc.fontSize(16).text('CONTRATO DE COMPRA (Produtor)', { align: 'center' });
          doc.moveDown();
          doc.fontSize(12).text(`Número do Pedido: ${order.orderNumber}`);
          doc.text(`Data: ${new Date(order.date).toLocaleDateString('pt-BR')}`);
          doc.text(`Produtor: ${this.getEntityName(order.producerId)}`);
          doc.text(`Total da Compra: R$ ${(order.totalCostAmount || 0).toFixed(2)}`);
          
          doc.addPage();
          
          doc.fontSize(20).text('AGRO VENDAS', { align: 'center' });
          doc.moveDown();
          doc.fontSize(16).text('CONTRATO DE VENDA (Cliente)', { align: 'center' });
          doc.moveDown();
          doc.fontSize(12).text(`Número do Pedido: ${order.orderNumber}`);
          doc.text(`Data: ${new Date(order.date).toLocaleDateString('pt-BR')}`);
          doc.text(`Cliente: ${this.getEntityName(order.customerId)}`);
          doc.text(`Total da Venda: R$ ${order.totalReceivableAmount.toFixed(2)}`);
        } else {
          doc.fontSize(16).text('RECIBO DE VENDA', { align: 'center' });
          doc.moveDown();
          doc.fontSize(12).text(`Número do Pedido: ${order.orderNumber}`);
          doc.text(`Data: ${new Date(order.date).toLocaleDateString('pt-BR')}`);
          doc.text(`Produtor: ${this.getEntityName(order.producerId)}`);
          doc.text(`Cliente: ${this.getEntityName(order.customerId)}`);
          doc.text(`Total da Operação: R$ ${order.totalReceivableAmount.toFixed(2)}`);
        }

        doc.moveDown(4);
        doc.text('___________________________', { align: 'center' });
        doc.text('Assinatura', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private getEntityName(entity: any): string {
    if (entity && typeof entity === 'object' && entity.name) {
      return entity.name;
    }
    return 'N/A';
  }
}
