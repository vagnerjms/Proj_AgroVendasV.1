import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrder, PurchaseOrderDocument } from './schemas/purchase-order.schema';
import { FiscalDocument } from '../fiscal-documents/schemas/fiscal-document.schema';
import { CountersService } from '../counters/counters.service';

import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name) private purchaseOrderModel: Model<PurchaseOrderDocument>,
    @InjectModel(FiscalDocument.name) private fiscalModel: Model<FiscalDocument>,
    private countersService: CountersService,
    private paymentsService: PaymentsService,
  ) {}

  async create(createDto: CreatePurchaseOrderDto) {
    const items = (createDto.items || []).map(item => {
      const quantityKg = this.roundQuantity((item.quantityBags || 0) * (item.bagWeightKg || 25));
      const lineTotal = this.roundMoney((item.quantityBags || 0) * (item.costPerBag || 0));
      return {
        ...item,
        quantityKg,
        lineTotal,
      };
    });

    const totalBags = this.roundQuantity(items.reduce((acc, item) => acc + item.quantityBags, 0));
    const totalKg = this.roundQuantity(items.reduce((acc, item) => acc + item.quantityKg, 0));
    const totalAmount = this.roundMoney(items.reduce((acc, item) => acc + item.lineTotal, 0));

    const funruralRate = createDto.funruralRate ?? 0.0163;
    const funruralSocialSecurityRate = createDto.funruralSocialSecurityRate ?? 0.013;
    const funruralRatRate = createDto.funruralRatRate ?? 0.001;
    const funruralSenarRate = createDto.funruralSenarRate ?? 0.0023;

    const funruralSocialSecurityAmount = this.roundMoney(totalAmount * funruralSocialSecurityRate);
    const funruralRatAmount = this.roundMoney(totalAmount * funruralRatRate);
    const funruralSenarAmount = this.roundMoney(totalAmount * funruralSenarRate);
    const funruralRetentionAmount = this.roundMoney(totalAmount * funruralRate);

    const producerNetAmount = this.roundMoney(totalAmount - funruralRetentionAmount);

    let orderNumber = 'DRAFT';
    if (createDto.status !== 'draft') {
      orderNumber = await this.countersService.nextCode('purchaseOrder', 'CO', 3);
    } else {
      orderNumber = `RASCUNHO-${Date.now()}`;
    }

    const created = new this.purchaseOrderModel({
      ...createDto,
      orderNumber,
      items,
      totalBags,
      totalKg,
      totalAmount,
      funruralSocialSecurityAmount,
      funruralRatAmount,
      funruralSenarAmount,
      funruralRetentionAmount,
      producerNetAmount,
    });

    await created.save();

    if (created.status === 'confirmed') {
      await this.paymentsService.ensurePayableForPurchaseOrder(created);
      
      const existingFiscal = await this.fiscalModel.findOne({ purchaseOrderId: created._id, isDeleted: false }).lean();
      if (!existingFiscal) {
        await this.fiscalModel.create({
          purchaseOrderId: created._id,
          orderNumber: created.orderNumber,
          status: 'pending',
          files: [],
        });
        await this.purchaseOrderModel.findByIdAndUpdate(created._id, { fiscalStatus: 'pending' });
      }
    }

    return created;
  }

  async findAll() {
    return this.purchaseOrderModel
      .find({ isDeleted: false })
      .limit(500)
      .populate('producerId', 'name')
      .populate('items.productId', 'name')
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string) {
    const order = await this.purchaseOrderModel
      .findOne({ _id: id, isDeleted: false })
      .populate('producerId', 'name city state')
      .populate('items.productId', 'name')
      .exec();
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async remove(id: string) {
    const order = await this.purchaseOrderModel.findByIdAndDelete(id);
    if (!order) throw new NotFoundException('Purchase order not found');
    
    await this.paymentsService.deleteForPurchaseOrder(id);
    
    // Cascade delete any linked fiscal document
    await this.fiscalModel.deleteMany(
      { purchaseOrderId: id }
    );
    
    return order;
  }

  async recalculateFinancials(id: string) {
    const order = await this.purchaseOrderModel.findOne({ _id: id, isDeleted: false });
    if (!order) return;

    const fiscalDocs = await this.fiscalModel.find({ purchaseOrderId: new Types.ObjectId(id), isDeleted: false, status: { $ne: 'cancelled' } }).lean();
    const nfeTotalAmount = fiscalDocs.reduce((sum, doc) => sum + (doc.amount || 0), 0);

    const taxBaseAmount = nfeTotalAmount > 0 ? nfeTotalAmount : (order.totalAmount || 0);

    const funruralRate = order.funruralRate ?? 0.0163;
    const funruralSocialSecurityRate = order.funruralSocialSecurityRate ?? 0.013;
    const funruralRatRate = order.funruralRatRate ?? 0.001;
    const funruralSenarRate = order.funruralSenarRate ?? 0.0023;

    const funruralSocialSecurityAmount = this.roundMoney(taxBaseAmount * funruralSocialSecurityRate);
    const funruralRatAmount = this.roundMoney(taxBaseAmount * funruralRatRate);
    const funruralSenarAmount = this.roundMoney(taxBaseAmount * funruralSenarRate);
    const funruralRetentionAmount = this.roundMoney(taxBaseAmount * funruralRate);

    const producerNetAmount = this.roundMoney((order.totalAmount || 0) - funruralRetentionAmount);

    const updated = await this.purchaseOrderModel.findByIdAndUpdate(
      id,
      {
        funruralSocialSecurityAmount,
        funruralRatAmount,
        funruralSenarAmount,
        funruralRetentionAmount,
        producerNetAmount,
      },
      { new: true }
    ).lean();

    if (updated?.status === 'confirmed') {
      await this.paymentsService.ensurePayableForPurchaseOrder(updated as any);
    }
  }

  async createDraft(date: string) {
    return {
      id: null,
      orderNumber: 'A GERAR',
      status: 'draft',
    };
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private roundQuantity(value: number) {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
  }
}
