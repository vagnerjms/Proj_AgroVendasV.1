import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CountersService } from '../counters/counters.service';
import { PaymentsService } from '../payments/payments.service';
import { CalculateSalesOrderDto } from './dto/calculate-sales-order.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrder } from './schemas/sales-order.schema';
import { FiscalDocument } from '../fiscal-documents/schemas/fiscal-document.schema';
import { SalesOrderCalculationService } from './sales-order-calculation.service';

type SalesOrderListFilters = {
  orderNumber?: string;
  customer?: string;
  producer?: string;
  status?: string;
  date?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
};

@Injectable()
export class SalesOrdersService {
  constructor(
    @InjectModel(SalesOrder.name) private readonly salesOrderModel: Model<SalesOrder>,
    @InjectModel(FiscalDocument.name) private readonly fiscalModel: Model<FiscalDocument>,
    private readonly calculationService: SalesOrderCalculationService,
    private readonly countersService: CountersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  findAll(filters: SalesOrderListFilters = {}) {
    const query: FilterQuery<SalesOrder> = {};

    if (filters.orderNumber) {
      query.orderNumber = { $regex: filters.orderNumber, $options: 'i' };
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query.date = { $gte: start, $lt: end };
    }

    return this.salesOrderModel
      .find(query)
      .populate('producerId customerId')
      .populate('items.productId')
      .sort({ date: -1, orderNumber: -1 })
      .lean()
      .then((orders) =>
        orders.filter((order) => {
          const customerName = this.getPopulatedName(order.customerId);
          const producerName = this.getPopulatedName(order.producerId);
          const customerMatches = filters.customer
            ? customerName.toLowerCase().includes(filters.customer.toLowerCase())
            : true;
          const producerMatches = filters.producer
            ? producerName.toLowerCase().includes(filters.producer.toLowerCase())
            : true;
          return customerMatches && producerMatches;
        }),
      )
      .then(async (filteredOrders) => {
        // Ordenação Dinâmica
        const sortBy = filters.sortBy || 'date';
        const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

        filteredOrders.sort((a, b) => {
          let valA: any = (a as any)[sortBy];
          let valB: any = (b as any)[sortBy];

          if (sortBy === 'orderNumber') {
            valA = a.orderNumber || '';
            valB = b.orderNumber || '';
          } else if (sortBy === 'product') {
            valA = (a.items?.[0]?.productId as any)?.name || '';
            valB = (b.items?.[0]?.productId as any)?.name || '';
          } else if (sortBy === 'customer') {
            valA = (a.customerId as any)?.name || '';
            valB = (b.customerId as any)?.name || '';
          } else if (sortBy === 'producer') {
            valA = (a.producerId as any)?.name || '';
            valB = (b.producerId as any)?.name || '';
          } else if (sortBy === 'bags') {
            valA = a.totalBags || 0;
            valB = b.totalBags || 0;
          } else if (sortBy === 'total') {
            valA = a.totalParticularAmount || 0;
            valB = b.totalParticularAmount || 0;
          } else if (sortBy === 'receivable') {
            valA = a.totalReceivableAmount || 0;
            valB = b.totalReceivableAmount || 0;
          } else if (sortBy === 'date') {
            valA = a.date ? new Date(a.date).getTime() : 0;
            valB = b.date ? new Date(b.date).getTime() : 0;
          } else if (sortBy === 'status') {
            valA = a.status || '';
            valB = b.status || '';
          }

          if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB, 'pt-BR', { numeric: true }) * sortOrder;
          }

          if (valA < valB) return -1 * sortOrder;
          if (valA > valB) return 1 * sortOrder;
          return 0;
        });

        const pageNum = filters.page ? parseInt(filters.page, 10) || 1 : null;
        const limitNum = filters.limit ? parseInt(filters.limit, 10) || 20 : 20;
        
        const total = filteredOrders.length;
        const paginatedOrders = pageNum 
          ? filteredOrders.slice((pageNum - 1) * limitNum, pageNum * limitNum)
          : filteredOrders;

        const ids = paginatedOrders.map((o) => o._id);
        const docs = await this.fiscalModel.find({ salesOrderId: { $in: ids } }).lean();
        const docMap = new Map(docs.map((d) => [d.salesOrderId?.toString(), d.amount || 0]));
        
        const data = paginatedOrders.map((o) => ({
          ...o,
          fiscalDocumentAmount: docMap.get(o._id.toString()) || 0,
        }));

        if (pageNum) {
          return { data, total, page: pageNum, limit: limitNum };
        }
        return data;
      });
  }

  async findOne(id: string) {
    const order = await this.salesOrderModel
      .findOne({ _id: id })
      .populate('producerId customerId')
      .populate('items.productId')
      .lean();
    if (!order) {
      throw new NotFoundException('Venda nao encontrada.');
    }
    return order;
  }

  async generateNextOrderNumber(): Promise<string> {
    const lastOrder = await this.salesOrderModel
      .findOne({ isDeleted: false })
      .sort({ orderNumber: -1 })
      .collation({ numericOrdering: true, locale: 'en' })
      .lean();
    if (!lastOrder || !lastOrder.orderNumber) {
      return 'VP001';
    }
    const numPart = lastOrder.orderNumber.replace('VP', '');
    const nextNum = (parseInt(numPart, 10) || 0) + 1;
    return `VP${String(nextNum).padStart(3, '0')}`;
  }

  async createDraft(date?: string) {
    const orderNumber = await this.generateNextOrderNumber();
    const draft = await this.salesOrderModel.create({
      orderNumber,
      saleType: 'particular',
      status: 'draft',
      date: date ? new Date(date) : new Date(),
      paymentType: 'cash',
      dueDateManual: false,
      items: [],
    });

    return {
      id: draft._id.toString(),
      _id: draft._id.toString(),
      orderNumber: draft.orderNumber,
      status: draft.status,
    };
  }

  async create(dto: CreateSalesOrderDto) {
    this.assertConfirmable(dto);

    const { draftId: _draftId, ...orderInput } = dto;
    const rates = await this.resolveFunruralRates(dto);
    const calculation = this.calculationService.calculate({
      ...dto,
      ...rates,
    });
    const date = dto.date ? new Date(dto.date) : new Date();
    const dueDate = this.resolveDueDate(dto, date);
    const payload = {
      ...orderInput,
      status: 'confirmed',
      saleType: dto.saleType || 'particular',
      date,
      dueDate,
      producerDueDate: dueDate,
      producerId: dto.producerId ? new Types.ObjectId(dto.producerId) : undefined,
      customerId: new Types.ObjectId(dto.customerId),
      destinationState: dto.destinationState.toUpperCase(),
      ...calculation,
    };

    if (dto.draftId) {
      const updated = await this.salesOrderModel
        .findOneAndUpdate({ _id: dto.draftId, status: 'draft' }, payload, { new: true })
        .lean();

      if (!updated) {
        throw new NotFoundException('Rascunho de venda nao encontrado.');
      }

      return this.afterConfirm(updated._id.toString());
    }

    const orderNumber = await this.generateNextOrderNumber();
    const created = await this.salesOrderModel.create({
      ...payload,
      orderNumber,
    });
    return this.afterConfirm(created._id.toString());
  }

  async update(id: string, dto: UpdateSalesOrderDto) {
    const existing = await this.salesOrderModel.findOne({ _id: id });
    if (!existing) {
      throw new NotFoundException('Venda nao encontrada.');
    }

    const merged = {
      ...existing.toObject(),
      ...dto,
      producerId: dto.producerId !== undefined ? dto.producerId : existing.producerId?.toString(),
      customerId: dto.customerId ?? existing.customerId?.toString(),
    } as CreateSalesOrderDto;

    if ((dto.status ?? existing.status) === 'confirmed') {
      this.assertConfirmable(merged);
    }

    const date = dto.date ? new Date(dto.date) : existing.date;
    let calculation = {};
    if (merged.items?.length) {
      const rates = await this.resolveFunruralRates(merged);
      calculation = this.calculationService.calculate({
        ...merged,
        ...rates,
      });
    }
    const updated = await this.salesOrderModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          date,
          dueDate: dto.dueDate || dto.termDays !== undefined ? this.resolveDueDate(merged, date) : existing.dueDate,
          producerId: dto.producerId ? new Types.ObjectId(dto.producerId) : existing.producerId,
          customerId: dto.customerId ? new Types.ObjectId(dto.customerId) : existing.customerId,
          destinationState: dto.destinationState?.toUpperCase() ?? existing.destinationState,
          ...calculation,
        },
        { new: true },
      )
      .lean();
    if (updated?.status === 'confirmed') {
      await this.afterConfirm(updated._id.toString());
    }
    return updated;
  }

  async softDelete(id: string) {
    const deleted = await this.salesOrderModel
      .findByIdAndDelete(id)
      .lean();
    if (!deleted) {
      throw new NotFoundException('Venda nao encontrada.');
    }
    await this.paymentsService.deleteForSalesOrder(id);
    
    // Cascade delete any linked fiscal document
    await this.fiscalModel.deleteMany(
      { salesOrderId: new Types.ObjectId(id) }
    );
    
    return { ok: true };
  }

  async recalculateFinancials(id: string) {
    const existing = await this.salesOrderModel.findOne({ _id: id, isDeleted: false });
    if (!existing) return;

    const fiscalDocs = await this.fiscalModel.find({ salesOrderId: new Types.ObjectId(id), isDeleted: false, status: { $ne: 'cancelled' } }).lean();
    const nfeTotalAmount = fiscalDocs.reduce((sum, doc) => sum + (doc.amount || 0), 0);

    const merged = { ...existing.toObject(), nfeTotalAmount } as unknown as CalculateSalesOrderDto;
    const calculation = this.calculationService.calculate(merged);

    const updated = await this.salesOrderModel.findByIdAndUpdate(
      id,
      { ...calculation },
      { new: true }
    ).lean();

    if (updated?.status === 'confirmed') {
      await this.afterConfirm(updated._id.toString());
    }
  }

  async calculate(dto: CalculateSalesOrderDto) {
    const rates = await this.resolveFunruralRates(dto);
    return this.calculationService.calculate({
      ...dto,
      ...rates,
    });
  }

  private async resolveFunruralRates(dto: { saleType?: string; producerId?: string; customerId?: string }) {
    const funruralRate = 0.0163;
    const funruralSocialSecurityRate = 0.013;
    const funruralRatRate = 0.001;
    const funruralSenarRate = 0.0023;
    let customerDocumentType = 'cnpj';

    if (dto.customerId) {
      try {
        const CustomerModel = this.salesOrderModel.db.model('Customer');
        const customer = await CustomerModel.findById(dto.customerId).lean() as any;
        if (customer && customer.documentType) {
          customerDocumentType = customer.documentType;
        }
      } catch (err) {
        console.error('Error loading customer for funrural calculation:', err);
      }
    }

    return {
      funruralRate,
      funruralSocialSecurityRate,
      funruralRatRate,
      funruralSenarRate,
      customerDocumentType,
    };
  }

  private assertConfirmable(dto: CreateSalesOrderDto) {
    const missingFields: string[] = [];
    if (!dto.producerId && dto.saleType !== 'venda_estoque') missingFields.push('producerId');
    if (!dto.customerId) missingFields.push('customerId');
    if (!dto.destinationCity) missingFields.push('destinationCity');
    if (!dto.destinationState) missingFields.push('destinationState');
    if (!dto.paymentType) missingFields.push('paymentType');
    if (!dto.items?.length) missingFields.push('items');

    const hasSaleValue = dto.items?.some((item) => item.quantityBags > 0 && item.pricePerBag > 0);
    if (!hasSaleValue) {
      missingFields.push('items com quantidade e valor');
    }

    if (missingFields.length) {
      throw new BadRequestException(`Campos obrigatorios ausentes para confirmar venda: ${missingFields.join(', ')}.`);
    }
  }

  private resolveDueDate(dto: Pick<CreateSalesOrderDto, 'dueDate' | 'dueDateManual' | 'paymentType' | 'termDays'>, date: Date) {
    if (dto.dueDateManual && dto.dueDate) {
      return new Date(dto.dueDate);
    }

    if (dto.paymentType === 'term') {
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + (dto.termDays ?? 0));
      return dueDate;
    }

    return new Date(date);
  }

  private getPopulatedName(value: unknown) {
    if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
      return value.name;
    }

    return '';
  }

  private async afterConfirm(id: string) {
    const order = await this.salesOrderModel.findById(id).populate('producerId customerId').populate('items.productId').lean();
    if (!order) {
      throw new NotFoundException('Venda confirmada nao encontrada.');
    }
    await this.paymentsService.ensureReceivableForSalesOrder(order);
    if (order.saleType !== 'venda_estoque') {
      await this.paymentsService.ensurePayableForSalesOrder(order);
    }

    const existingFiscal = await this.fiscalModel.findOne({ salesOrderId: order._id }).lean();
    if (!existingFiscal) {
      await this.fiscalModel.create({
        salesOrderId: order._id,
        orderNumber: order.orderNumber,
        status: 'pending',
        files: [],
      });
      await this.salesOrderModel.findByIdAndUpdate(id, { fiscalStatus: 'pending' });
    }

    return order;
  }

  static ensureTempStorage(): string {
    const tempPath = path.join(process.cwd(), 'temp-storage', 'sales');
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }
    return tempPath;
  }

  getFilePath(id: string, filename: string): string {
    const filePath = path.join(SalesOrdersService.ensureTempStorage(), filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
    return filePath;
  }

  async attachFile(id: string, file: Express.Multer.File) {
    const order = await this.salesOrderModel.findById(id).populate('customerId').lean();
    if (!order) {
      throw new NotFoundException('Venda não encontrada');
    }
    const updated = await this.salesOrderModel.findByIdAndUpdate(
      id,
      { $push: { attachments: file.filename } },
      { new: true }
    );

    // Disparar Webhook para n8n em segundo plano
    const partnerName = (order.customerId as any)?.name || 'Cliente';
    this.triggerWebhook({
      orderNumber: order.orderNumber,
      partnerName,
      fileType: 'anexo_venda',
      originalName: file.originalname,
      downloadUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://179.197.231.106:3001'}/sales-orders/${order._id}/files/${file.filename}?apiKey=${process.env.API_KEY || 'AgroVendas_n8n_Secret_Key_2026'}`
    }).catch(err => console.error('Erro ao disparar webhook para n8n:', err));

    return updated;
  }

  private async triggerWebhook(payload: {
    orderNumber: string;
    partnerName: string;
    fileType: string;
    originalName: string;
    downloadUrl: string;
  }) {
    const url = process.env.N8N_WEBHOOK_URL || 'http://179.197.231.106:5678/webhook/agrovendas-uploads';
    try {
      await (global as any).fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.error(`Erro ao disparar webhook para n8n (${url}):`, err.message);
    }
  }

  async removeFile(id: string, filename: string) {
    const order = await this.salesOrderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Venda não encontrada');
    }
    
    // Remove do array no BD
    const updated = await this.salesOrderModel.findByIdAndUpdate(
      id,
      { $pull: { attachments: filename } },
      { new: true }
    );

    // Remove arquivo fisicamente
    const filePath = path.join(SalesOrdersService.ensureTempStorage(), filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Erro ao excluir arquivo:', err);
      }
    }

    return updated;
  }
}
