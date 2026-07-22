import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { SettlePaymentDto } from './dto/settle-payment.dto';
import { Payment } from './schemas/payment.schema';

type PaymentFilters = {
  type?: string;
  status?: string;
  orderNumber?: string;
  customerId?: string;
  producerId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
};

type SalesOrderForReceivable = {
  _id: Types.ObjectId | string;
  orderNumber: string;
  customerId?: unknown;
  producerId?: unknown;
  totalReceivableAmount?: number;
  producerNetAmount?: number;
  dueDate?: Date | string;
  producerDueDate?: Date | string;
  saleType?: string;
  brokerageAmount?: number;
  brokeragePayer?: string;
};

@Injectable()
export class PaymentsService {
  constructor(@InjectModel(Payment.name) private readonly paymentModel: Model<Payment>) {}

  async findAll(filters: PaymentFilters = {}) {
    const query: FilterQuery<Payment> = { isDeleted: false };
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.orderNumber) query.orderNumber = { $regex: filters.orderNumber, $options: 'i' };
    if (filters.customerId) query.customerId = new Types.ObjectId(filters.customerId);
    if (filters.producerId) query.producerId = new Types.ObjectId(filters.producerId);
    if (filters.dueDateFrom || filters.dueDateTo) {
      query.dueDate = {};
      if (filters.dueDateFrom) query.dueDate.$gte = new Date(`${filters.dueDateFrom}T00:00:00.000Z`);
      if (filters.dueDateTo) query.dueDate.$lte = new Date(`${filters.dueDateTo}T23:59:59.999Z`);
    }

    const payments = await this.paymentModel
      .find(query)
      .limit(500)
      .populate('salesOrderId purchaseOrderId customerId producerId')
      .sort({ dueDate: 1, orderNumber: 1 })
      .lean();

    return payments.filter((p: any) => {
      if (p.salesOrderId && (p.salesOrderId.isDeleted || p.salesOrderId.status === 'cancelled')) return false;
      if (p.purchaseOrderId && (p.purchaseOrderId.isDeleted || p.purchaseOrderId.status === 'cancelled')) return false;
      return true;
    });
  }

  async findOne(id: string) {
    const payment = await this.paymentModel.findOne({ _id: id, isDeleted: false }).populate('salesOrderId customerId producerId').lean();
    if (!payment) {
      throw new NotFoundException('Conta nao encontrada.');
    }
    return payment;
  }

  async ensureReceivableForSalesOrder(order: SalesOrderForReceivable) {
    const salesOrderId = new Types.ObjectId(this.getId(order._id));
    
    // Para intermediação, o valor cheio a receber do cliente é o totalParticularAmount
    const amount = order.saleType === 'intermediacao'
      ? this.roundMoney(order.totalParticularAmount ?? 0)
      : this.roundMoney(order.totalReceivableAmount ?? 0);

    // Limpar contas de corretagem antigas com sufixos se existirem
    await this.paymentModel.deleteMany({ salesOrderId, type: 'receivable', orderNumber: { $in: [order.orderNumber + '-P', order.orderNumber + '-C'] } });

    const existing = await this.paymentModel.findOne({ salesOrderId, type: 'receivable', isDeleted: false, orderNumber: order.orderNumber }).lean();
    if (existing) {
      if (existing.status !== 'cancelled' && existing.amount !== amount) {
        const balanceAmount = this.roundMoney(amount - existing.paidAmount);
        await this.paymentModel.findByIdAndUpdate(existing._id, {
          amount,
          balanceAmount,
          status: balanceAmount <= 0 ? 'paid' : (existing.paidAmount > 0 ? 'partial' : 'open'),
        });
      }
      return existing;
    }
    const customer = this.extractEntity(order.customerId);
    const producer = this.extractEntity(order.producerId);

    return this.paymentModel.create({
      type: 'receivable',
      salesOrderId,
      orderNumber: order.orderNumber,
      customerId: customer.id ? new Types.ObjectId(customer.id) : undefined,
      customerName: customer.name,
      customerWhatsapp: customer.whatsapp,
      producerId: producer.id ? new Types.ObjectId(producer.id) : undefined,
      producerName: producer.name,
      amount,
      paidAmount: 0,
      balanceAmount: amount,
      dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
      status: 'open',
      history: [],
    });
  }

  async ensurePayableForSalesOrder(order: SalesOrderForReceivable) {
    const salesOrderId = new Types.ObjectId(this.getId(order._id));

    if (order.saleType === 'intermediacao' || order.saleType === 'venda_estoque') {
      // Limpar qualquer conta a pagar de compra criada anteriormente para esta venda
      await this.paymentModel.deleteMany({ salesOrderId, type: 'payable' });
      return null;
    }

    const amount = this.roundMoney(order.producerNetAmount ?? order.totalReceivableAmount ?? 0);

    const existing = await this.paymentModel.findOne({ salesOrderId, type: 'payable', isDeleted: false }).lean();
    if (existing) {
      if (existing.status !== 'cancelled' && existing.amount !== amount) {
        const balanceAmount = this.roundMoney(amount - existing.paidAmount);
        await this.paymentModel.findByIdAndUpdate(existing._id, {
          amount,
          balanceAmount,
          status: balanceAmount <= 0 ? 'paid' : (existing.paidAmount > 0 ? 'partial' : 'open'),
        });
      }
      return existing;
    }
    if (amount <= 0) {
      return null;
    }
    const customer = this.extractEntity(order.customerId);
    const producer = this.extractEntity(order.producerId);

    return this.paymentModel.create({
      type: 'payable',
      salesOrderId,
      orderNumber: order.orderNumber,
      customerId: customer.id ? new Types.ObjectId(customer.id) : undefined,
      customerName: customer.name,
      customerWhatsapp: customer.whatsapp,
      producerId: producer.id ? new Types.ObjectId(producer.id) : undefined,
      producerName: producer.name,
      amount,
      paidAmount: 0,
      balanceAmount: amount,
      dueDate: order.producerDueDate ? new Date(order.producerDueDate) : order.dueDate ? new Date(order.dueDate) : new Date(),
      status: 'open',
      history: [],
    });
  }

  async ensurePayableForPurchaseOrder(order: any) {
    const purchaseOrderId = new Types.ObjectId(this.getId(order._id));
    const amount = this.roundMoney(order.producerNetAmount ?? order.totalAmount ?? 0);

    const existing = await this.paymentModel.findOne({ orderNumber: order.orderNumber, type: 'payable', isDeleted: false }).lean();
    if (existing) {
      if (existing.status !== 'cancelled' && existing.amount !== amount) {
        const balanceAmount = this.roundMoney(amount - existing.paidAmount);
        await this.paymentModel.findByIdAndUpdate(existing._id, {
          amount,
          balanceAmount,
          status: balanceAmount <= 0 ? 'paid' : (existing.paidAmount > 0 ? 'partial' : 'open'),
        });
      }
      return existing;
    }
    const producer = this.extractEntity(order.producerId);

    return this.paymentModel.create({
      type: 'payable',
      purchaseOrderId,
      orderNumber: order.orderNumber,
      producerId: producer.id ? new Types.ObjectId(producer.id) : undefined,
      producerName: producer.name,
      amount,
      paidAmount: 0,
      balanceAmount: amount,
      dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
      status: 'open',
      history: [],
    });
  }

  async settle(id: string, dto: SettlePaymentDto) {
    const payment = await this.paymentModel.findOne({ _id: id, isDeleted: false });
    if (!payment) {
      throw new NotFoundException('Conta nao encontrada.');
    }
    if (payment.status === 'cancelled') {
      throw new BadRequestException('Conta cancelada nao pode receber baixa.');
    }
    if (payment.status === 'paid') {
      throw new BadRequestException('Conta ja esta quitada.');
    }

    const nextPaidAmount = this.roundMoney(payment.paidAmount + dto.amount);
    if (nextPaidAmount - payment.amount > 0.01) {
      throw new BadRequestException('Valor pago excede o saldo da conta.');
    }

    const balanceAmount = this.roundMoney(payment.amount - nextPaidAmount);
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    payment.paidAmount = nextPaidAmount;
    payment.balanceAmount = balanceAmount;
    payment.paidAt = balanceAmount <= 0.01 ? paidAt : payment.paidAt;
    payment.method = dto.method ?? payment.method;
    payment.status = balanceAmount <= 0.01 ? 'paid' : 'partial';
    payment.history.push({
      amount: dto.amount,
      paidAt,
      method: dto.method,
      notes: dto.notes,
      createdAt: new Date(),
    });

    return payment.save();
  }

  async cancel(id: string, notes?: string) {
    const payment = await this.paymentModel
      .findOneAndUpdate(
        { _id: id, isDeleted: false },
        { status: 'cancelled', notes },
        { new: true },
      )
      .lean();
    if (!payment) {
      throw new NotFoundException('Conta nao encontrada.');
    }
    return payment;
  }

  async deleteForSalesOrder(salesOrderId: string) {
    const sId = new Types.ObjectId(salesOrderId);
    await this.paymentModel.deleteMany({
      $or: [{ salesOrderId: sId }, { salesOrderId }]
    });
  }

  async deleteForPurchaseOrder(purchaseOrderId: string) {
    const pId = new Types.ObjectId(purchaseOrderId);
    await this.paymentModel.deleteMany({
      $or: [{ purchaseOrderId: pId }, { purchaseOrderId }]
    });
  }

  async alerts() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const next3DaysEnd = new Date(todayEnd);
    next3DaysEnd.setDate(next3DaysEnd.getDate() + 3);

    const receivableBase: FilterQuery<Payment> = {
      isDeleted: false,
      type: 'receivable',
      status: { $in: ['open', 'partial'] },
    };
    const payableBase: FilterQuery<Payment> = {
      isDeleted: false,
      type: 'payable',
      status: { $in: ['open', 'partial'] },
    };

    const [
      receivablesOverdue,
      receivablesDueToday,
      receivablesDueSoon,
      payablesOverdue,
      payablesDueToday,
      payablesDueSoon,
    ] = await Promise.all([
      this.findDueAlerts(receivableBase, { $lt: todayStart }),
      this.findDueAlerts(receivableBase, { $gte: todayStart, $lte: todayEnd }),
      this.findDueAlerts(receivableBase, { $gt: todayEnd, $lte: next3DaysEnd }),
      this.findDueAlerts(payableBase, { $lt: todayStart }),
      this.findDueAlerts(payableBase, { $gte: todayStart, $lte: todayEnd }),
      this.findDueAlerts(payableBase, { $gt: todayEnd, $lte: next3DaysEnd }),
    ]);

    return {
      receivablesOverdue,
      receivablesDueToday,
      receivablesDueSoon,
      payablesOverdue,
      payablesDueToday,
      payablesDueSoon,
      overdue: receivablesOverdue,
      dueToday: receivablesDueToday,
      dueNext3Days: receivablesDueSoon,
    };
  }

  async summary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [receivables, payables] = await Promise.all([
      this.paymentModel.find({ isDeleted: false, type: 'receivable' }).lean(),
      this.paymentModel.find({ isDeleted: false, type: 'payable' }).lean(),
    ]);

    return {
      receivableOpenAmount: this.sumBalance(receivables.filter((payment) => this.isOpen(payment))),
      receivableOverdueAmount: this.sumBalance(receivables.filter((payment) => this.isOpen(payment) && payment.dueDate < todayStart)),
      receivablePaidAmount: this.sumPaidThisMonth(receivables, monthStart, monthEnd),
      payableOpenAmount: this.sumBalance(payables.filter((payment) => this.isOpen(payment))),
      payableOverdueAmount: this.sumBalance(payables.filter((payment) => this.isOpen(payment) && payment.dueDate < todayStart)),
      payablePaidAmount: this.sumPaidThisMonth(payables, monthStart, monthEnd),
    };
  }

  private extractEntity(value: unknown) {
    if (!value) {
      return { id: undefined, name: undefined };
    }
    if (value instanceof Types.ObjectId) {
      return { id: value.toString(), name: undefined };
    }
    if (typeof value === 'string') {
      return { id: value, name: undefined };
    }
    if (typeof value === 'object') {
      const record = value as { _id?: unknown; name?: unknown; whatsapp?: unknown };
      return {
        id: this.getId(record._id),
        name: typeof record.name === 'string' ? record.name : undefined,
        whatsapp: typeof record.whatsapp === 'string' ? record.whatsapp : undefined,
      };
    }
    return { id: undefined, name: undefined };
  }

  private getId(value: unknown) {
    if (!value) return undefined;
    if (value instanceof Types.ObjectId) return value.toString();
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && 'toString' in value) return String(value);
    return undefined;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async findDueAlerts(base: FilterQuery<Payment>, dueDate: FilterQuery<Payment>['dueDate']) {
    const payments = await this.paymentModel
      .find({ ...base, dueDate })
      .populate('salesOrderId purchaseOrderId customerId producerId')
      .sort({ dueDate: 1 })
      .lean();

    return payments.filter((p: any) => {
      if (p.salesOrderId && (p.salesOrderId.isDeleted || p.salesOrderId.status === 'cancelled')) return false;
      if (p.purchaseOrderId && (p.purchaseOrderId.isDeleted || p.purchaseOrderId.status === 'cancelled')) return false;
      return true;
    });
  }

  private isOpen(payment: Payment) {
    return ['open', 'partial', 'overdue'].includes(payment.status);
  }

  private sumBalance(payments: Payment[]) {
    return this.roundMoney(payments.reduce((sum, payment) => sum + (payment.balanceAmount ?? 0), 0));
  }

  private sumPaidThisMonth(payments: Payment[], monthStart: Date, monthEnd: Date) {
    const total = payments.reduce((sum, payment) => {
      const historyTotal = (payment.history ?? []).reduce((historySum, entry) => {
        const paidAt = new Date(entry.paidAt);
        return paidAt >= monthStart && paidAt < monthEnd ? historySum + entry.amount : historySum;
      }, 0);
      return sum + historyTotal;
    }, 0);
    return this.roundMoney(total);
  }
}
