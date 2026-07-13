import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FiscalDocument } from '../fiscal-documents/schemas/fiscal-document.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { PurchaseOrder } from '../purchase-orders/schemas/purchase-order.schema';
import { SalesOrder } from '../sales-orders/schemas/sales-order.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(SalesOrder.name) private readonly salesOrderModel: Model<SalesOrder>,
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrder>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(FiscalDocument.name) private readonly fiscalDocumentModel: Model<FiscalDocument>,
  ) {}

  async summary(start?: string, end?: string) {
    const now = new Date();
    
    let periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (start) {
      periodStart = new Date(`${start}T00:00:00.000Z`);
    }
    if (end) {
      periodEnd = new Date(`${end}T23:59:59.999Z`);
    } else if (start) {
      // If start provided but no end, use the start date end of day
      periodEnd = new Date(`${start}T23:59:59.999Z`);
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const openStatuses = ['open', 'partial', 'overdue'];

    const [salesMonth, openReceivables, openPayables, paidReceivablesThisMonth, recentSales, recentPurchases] = await Promise.all([
      this.salesOrderModel.find({ isDeleted: false, status: 'confirmed', date: { $gte: periodStart, $lte: periodEnd } }).lean(),
      this.paymentModel.find({ isDeleted: false, type: 'receivable', status: { $in: openStatuses } }).lean(),
      this.paymentModel.find({ isDeleted: false, type: 'payable', status: { $in: openStatuses } }).lean(),
      this.paymentModel.find({ isDeleted: false, type: 'receivable', 'history.paidAt': { $gte: periodStart, $lte: periodEnd } }).lean(),
      this.salesOrderModel.find({ isDeleted: false, status: 'confirmed' }).sort({ createdAt: -1 }).limit(5).lean(),
      this.purchaseOrderModel.find({ isDeleted: false, status: 'confirmed' }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const [pendingSales, pendingPurchases, divergentSales, divergentPurchases] = await Promise.all([
      this.salesOrderModel.countDocuments({ isDeleted: false, status: 'confirmed', fiscalStatus: 'pending' }),
      this.purchaseOrderModel.countDocuments({ isDeleted: false, status: 'confirmed', fiscalStatus: 'pending' }),
      this.salesOrderModel.countDocuments({ isDeleted: false, status: 'confirmed', fiscalStatus: 'divergent' }),
      this.purchaseOrderModel.countDocuments({ isDeleted: false, status: 'confirmed', fiscalStatus: 'divergent' }),
    ]);

    const fiscalPendingCount = pendingSales + pendingPurchases;
    const fiscalDivergentCount = divergentSales + divergentPurchases;

    const recentTransactions = [
      ...recentSales.map((s: any) => ({ type: 'Venda', date: s.date, amount: s.totalParticularAmount ?? s.brokerageAmount ?? 0, createdAt: s.createdAt })),
      ...recentPurchases.map((p: any) => ({ type: 'Compra', date: p.date, amount: p.totalAmount ?? 0, createdAt: p.createdAt }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    return {
      salesCountMonth: salesMonth.length,
      salesAmountMonth: this.roundMoney(salesMonth.reduce((sum, sale) => sum + (sale.totalParticularAmount ?? 0), 0)),
      profitMonth: this.roundMoney(salesMonth.reduce((sum, sale) => {
        if (sale.saleType === 'particular') {
          return sum + (sale.totalParticularAmount ?? 0);
        }
        return sum + (sale.marginAmount ?? 0) + (sale.brokerageAmount ?? 0);
      }, 0)),
      totalReceivableOpen: this.roundMoney(openReceivables.reduce((sum, payment) => sum + (payment.balanceAmount ?? 0), 0)),
      totalReceivableOverdue: this.roundMoney(
        openReceivables.filter((payment) => payment.dueDate < todayStart).reduce((sum, payment) => sum + (payment.balanceAmount ?? 0), 0),
      ),
      totalReceivedMonth: this.sumPaidThisMonth(paidReceivablesThisMonth as any, periodStart, periodEnd),
      totalPayableOpen: this.roundMoney(openPayables.reduce((sum, payment) => sum + (payment.balanceAmount ?? 0), 0)),
      fiscalPendingCount,
      fiscalDivergentCount,
      recentTransactions,
      chartData: Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        const dayStart = new Date(d.setHours(0, 0, 0, 0));
        const dayEnd = new Date(d.setHours(23, 59, 59, 999));
        const daySales = salesMonth.filter(s => {
           const sDate = new Date(s.date);
           return sDate >= dayStart && sDate <= dayEnd;
        });
        return this.roundMoney(daySales.reduce((sum, sale) => sum + (sale.totalParticularAmount ?? sale.brokerageAmount ?? 0), 0));
      }),
    };
  }


  private isOpen(status: string) {
    return ['open', 'partial', 'overdue'].includes(status);
  }

  private sumPaidThisMonth(payments: Payment[], periodStart: Date, periodEnd: Date) {
    const total = payments.reduce((sum, payment) => {
      const historyTotal = (payment.history ?? []).reduce((historySum, entry) => {
        const paidAt = new Date(entry.paidAt);
        return paidAt >= periodStart && paidAt <= periodEnd ? historySum + entry.amount : historySum;
      }, 0);
      return sum + historyTotal;
    }, 0);
    return this.roundMoney(total);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async fiscalSummary(start?: string, end?: string) {
    const now = new Date();
    let periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (start) {
      periodStart = new Date(`${start}T00:00:00.000Z`);
    }
    if (end) {
      periodEnd = new Date(`${end}T23:59:59.999Z`);
    }

    const [purchases, sales] = await Promise.all([
      this.purchaseOrderModel.find({ isDeleted: false, status: 'confirmed', date: { $gte: periodStart, $lt: periodEnd } }).lean(),
      this.salesOrderModel.find({ isDeleted: false, status: 'confirmed', date: { $gte: periodStart, $lt: periodEnd } })
        .populate('customerId')
        .lean(),
    ]);

    const purchasesFunrural = purchases.reduce((sum, order) => sum + (order.funruralRetentionAmount ?? 0), 0);
    const salesFunruralLiability = sales
      .filter((order: any) => order.customerId?.documentType !== 'cnpj')
      .reduce((sum, order) => sum + (order.funruralRetentionAmount ?? 0), 0);
    const salesFunruralRetainedByCustomers = sales
      .filter((order: any) => order.customerId?.documentType === 'cnpj')
      .reduce((sum, order) => sum + (order.funruralRetentionAmount ?? 0), 0);

    return {
      purchasesFunrural: this.roundMoney(purchasesFunrural + salesFunruralLiability),
      salesFunruralRetainedByCustomers: this.roundMoney(salesFunruralRetainedByCustomers),
      totalLiability: this.roundMoney(purchasesFunrural + salesFunruralLiability),
    };
  }

  async lojaPdfData(start?: string, end?: string) {
    let periodStart = new Date(1970, 0, 1);
    let periodEnd = new Date(2100, 0, 1);

    if (start) {
      periodStart = new Date(`${start}T00:00:00.000Z`);
    }
    if (end) {
      periodEnd = new Date(`${end}T23:59:59.999Z`);
    }

    const sales = await this.salesOrderModel
      .find({ isDeleted: false, status: { $ne: 'cancelled' }, date: { $gte: periodStart, $lte: periodEnd } })
      .populate('customerId', 'name')
      .populate('producerId', 'name')
      .populate('items.productId', 'name')
      .lean();

    const saleIds = sales.map(s => s._id);

    const [payments, fiscalDocs] = await Promise.all([
      this.paymentModel.find({ isDeleted: false, salesOrderId: { $in: saleIds } }).lean(),
      this.fiscalDocumentModel.find({ isDeleted: false, salesOrderId: { $in: saleIds } }).lean()
    ]);

    const result = sales.map((sale: any) => {
      const salePayments = payments.filter(p => p.salesOrderId?.toString() === sale._id.toString());
      const saleDocs = fiscalDocs.filter(f => f.salesOrderId?.toString() === sale._id.toString());
      
      const recebido = salePayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
      const aReceber = sale.totalReceivableAmount || 0;
      const saldo = aReceber - recebido;
      
      const nfeValue = saleDocs.reduce((sum, f) => sum + (f.amount || 0), 0);
      const nfeNumbers = saleDocs.map(f => f.number).filter(Boolean).join(', ');

      return {
        ...sale,
        customerName: sale.customerId?.name || 'Desconhecido',
        producerName: sale.saleType === 'venda_estoque' ? 'AgroVendas' : (sale.producerId?.name || 'Desconhecido'),
        recebido: this.roundMoney(recebido),
        aReceber: this.roundMoney(aReceber),
        nfeValue: this.roundMoney(nfeValue),
        nfeNumbers: nfeNumbers || '-',
        saldo: this.roundMoney(saldo)
      };
    });

    return result;
  }
}
