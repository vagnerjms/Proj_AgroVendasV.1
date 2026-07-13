import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { basename, extname, join } from 'path';
import { FilterQuery, Model, Types } from 'mongoose';
import { PurchaseOrder } from '../purchase-orders/schemas/purchase-order.schema';
import { SalesOrder } from '../sales-orders/schemas/sales-order.schema';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import { UpdateFiscalDocumentDto } from './dto/update-fiscal-document.dto';
import { FiscalDocument, FiscalFileKind } from './schemas/fiscal-document.schema';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';

type FiscalFilters = {
  orderNumber?: string;
  customerId?: string;
  producerId?: string;
  number?: string;
  accessKey?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

const FISCAL_TOLERANCE = Number(process.env.FISCAL_AMOUNT_TOLERANCE ?? 0.01);
const STORAGE_ROOT = join(process.cwd(), 'storage', 'fiscal-documents');
const TEMP_STORAGE = join(process.cwd(), 'storage', 'tmp', 'fiscal-documents');

@Injectable()
export class FiscalDocumentsService {
  constructor(
    @InjectModel(FiscalDocument.name) private readonly fiscalDocumentModel: Model<FiscalDocument>,
    @InjectModel(SalesOrder.name) private readonly salesOrderModel: Model<SalesOrder>,
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrder>,
    private readonly salesOrdersService: SalesOrdersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  static ensureTempStorage() {
    if (!existsSync(TEMP_STORAGE)) {
      mkdirSync(TEMP_STORAGE, { recursive: true });
    }
    return TEMP_STORAGE;
  }

  findAll(filters: FiscalFilters = {}) {
    return this.buildQuery(filters).then((query) =>
      this.fiscalDocumentModel
        .find(query)
        .limit(500)
        .populate('salesOrderId')
        .populate('purchaseOrderId')
        .sort({ issuedAt: -1, createdAt: -1 })
        .lean(),
    );
  }

  async findOne(id: string) {
    const fiscalDocument = await this.fiscalDocumentModel.findOne({ _id: id, isDeleted: false }).populate('salesOrderId').populate('purchaseOrderId').lean();
    if (!fiscalDocument) {
      throw new NotFoundException('Documento fiscal nao encontrado.');
    }
    return fiscalDocument;
  }

  async alerts() {
    const [pending, divergent] = await Promise.all([
      this.fiscalDocumentModel.find({ isDeleted: false, status: 'pending' }).populate('salesOrderId').populate('purchaseOrderId').sort({ issuedAt: -1, createdAt: -1 }).lean(),
      this.fiscalDocumentModel.find({ isDeleted: false, status: 'divergent' }).populate('salesOrderId').populate('purchaseOrderId').sort({ issuedAt: -1, createdAt: -1 }).lean(),
    ]);
    
    const filterValid = (docs: any[]) => docs.filter(doc => {
      // If parent is missing entirely (null)
      if (!doc.salesOrderId && !doc.purchaseOrderId) return false;
      // If parent is an unpopulated ObjectId (orphaned hard-delete)
      if (doc.salesOrderId && !doc.salesOrderId.orderNumber) return false;
      if (doc.purchaseOrderId && !doc.purchaseOrderId.orderNumber) return false;
      // If parent is soft-deleted
      if (doc.salesOrderId && doc.salesOrderId.isDeleted) return false;
      if (doc.purchaseOrderId && doc.purchaseOrderId.isDeleted) return false;
      return true;
    });

    return { 
      pending: filterValid(pending), 
      divergent: filterValid(divergent) 
    };
  }

  async create(dto: CreateFiscalDocumentDto) {
    if (!dto.salesOrderId && !dto.purchaseOrderId) {
      throw new BadRequestException('Venda ou compra deve ser informada.');
    }
    const order = await this.findOrder(dto.salesOrderId, dto.purchaseOrderId);
    const status = this.resolveStatus(dto.status, dto.amount, order);
    const fiscalDocument = await this.fiscalDocumentModel.create({
      ...dto,
      salesOrderId: dto.salesOrderId ? order._id : undefined,
      purchaseOrderId: dto.purchaseOrderId ? order._id : undefined,
      orderNumber: order.orderNumber,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
      status,
      files: [],
    });
    await this.updateOrderFiscalStatus(order, status);
    
    if (dto.salesOrderId) await this.salesOrdersService.recalculateFinancials(dto.salesOrderId);
    if (dto.purchaseOrderId) await this.purchaseOrdersService.recalculateFinancials(dto.purchaseOrderId);

    return fiscalDocument;
  }

  async update(id: string, dto: UpdateFiscalDocumentDto) {
    const existing = await this.fiscalDocumentModel.findOne({ _id: id, isDeleted: false });
    if (!existing) {
      throw new NotFoundException('Documento fiscal nao encontrado.');
    }
    const order = await this.findOrder(
      dto.salesOrderId ?? existing.salesOrderId?.toString(),
      dto.purchaseOrderId ?? existing.purchaseOrderId?.toString()
    );
    const nextAmount = dto.amount ?? existing.amount;
    const status = this.resolveStatus(dto.status ?? existing.status, nextAmount, order);
    const updated = await this.fiscalDocumentModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          salesOrderId: 'totalReceivableAmount' in order ? (order as any)._id : undefined,
          purchaseOrderId: !('totalReceivableAmount' in order) ? (order as any)._id : undefined,
          orderNumber: order.orderNumber,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : existing.issuedAt,
          status,
        },
        { new: true },
      )
      .lean();
    await this.updateOrderFiscalStatus(order, status);

    const sId = dto.salesOrderId ?? existing.salesOrderId?.toString();
    const pId = dto.purchaseOrderId ?? existing.purchaseOrderId?.toString();
    if (sId) await this.salesOrdersService.recalculateFinancials(sId);
    if (pId) await this.purchaseOrdersService.recalculateFinancials(pId);

    return updated;
  }

  async remove(id: string) {
    const existing = await this.fiscalDocumentModel.findOne({ _id: id });
    if (!existing) {
      throw new NotFoundException('Documento fiscal nao encontrado.');
    }

    // 1. Apagar os arquivos físicos do storage
    for (const file of existing.files) {
      if (file.storagePath && existsSync(file.storagePath)) {
        try {
          import('fs').then(fs => fs.unlinkSync(file.storagePath));
        } catch (e) {
          console.error(`Erro ao excluir arquivo fiscal físico: ${file.storagePath}`, e);
        }
      }
    }
    
    // Tentativa de apagar a pasta da operação caso fique vazia
    const orderDir = join(STORAGE_ROOT, existing.orderNumber);
    if (existsSync(orderDir)) {
      try {
        import('fs').then(fs => {
          const filesInDir = fs.readdirSync(orderDir);
          if (filesInDir.length === 0) {
            fs.rmdirSync(orderDir);
          }
        });
      } catch (e) {
        // Ignorar falhas de exclusão de pasta
      }
    }

    // 2. Limpar os dados do documento fiscal no banco, mantendo-o como pendente
    await this.fiscalDocumentModel.updateOne({ _id: id }, {
      $set: {
        status: 'pending',
        files: [],
      },
      $unset: {
        number: "",
        series: "",
        accessKey: "",
        issuer: "",
        recipient: "",
        amount: "",
        notes: "",
        issuedAt: ""
      }
    });

    // 3. Atualizar o status da Ordem/Compra de volta para pending
    try {
      const order = await this.findOrder(
        existing.salesOrderId?.toString(),
        existing.purchaseOrderId?.toString()
      );
      if (order) {
        await this.updateOrderFiscalStatus(order, 'pending');
      }
    } catch (e) {
      // Pedido original pode já ter sido excluído
    }

    const sId = existing.salesOrderId?.toString();
    const pId = existing.purchaseOrderId?.toString();
    if (sId) await this.salesOrdersService.recalculateFinancials(sId);
    if (pId) await this.purchaseOrdersService.recalculateFinancials(pId);

    return { success: true };
  }

  async attachFile(id: string, file: Express.Multer.File) {
    const fiscalDocument = await this.fiscalDocumentModel.findOne({ _id: id, isDeleted: false });
    if (!fiscalDocument) {
      throw new NotFoundException('Documento fiscal nao encontrado.');
    }
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado.');
    }

    const orderDir = join(STORAGE_ROOT, fiscalDocument.orderNumber);
    if (!existsSync(orderDir)) {
      mkdirSync(orderDir, { recursive: true });
    }

    const safeName = `${Date.now()}-${basename(file.originalname).replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const targetPath = join(orderDir, safeName);
    renameSync(file.path, targetPath);

    const fileEntry = {
      kind: this.resolveFileKind(file.mimetype, file.originalname),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath: targetPath,
      uploadedAt: new Date(),
    };

    fiscalDocument.files.push(fileEntry);
    await fiscalDocument.save();
    return fileEntry;
  }

  async getFilePath(id: string, fileId: string) {
    const fiscalDocument = await this.fiscalDocumentModel.findOne({ _id: id, isDeleted: false }).lean();
    if (!fiscalDocument) {
      throw new NotFoundException('Documento fiscal nao encontrado.');
    }
    const file = fiscalDocument.files.find((entry) => {
      const entryWithId = entry as typeof entry & { _id?: Types.ObjectId };
      return entryWithId._id?.toString() === fileId;
    });
    if (!file) {
      throw new NotFoundException('Arquivo fiscal nao encontrado.');
    }
    return file;
  }

  private async buildQuery(filters: FiscalFilters) {
    const query: FilterQuery<FiscalDocument> = { isDeleted: false };
    if (filters.orderNumber) query.orderNumber = { $regex: filters.orderNumber, $options: 'i' };
    if (filters.number) query.number = { $regex: filters.number, $options: 'i' };
    if (filters.accessKey) query.accessKey = { $regex: filters.accessKey, $options: 'i' };
    if (filters.status) query.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      query.issuedAt = {};
      if (filters.dateFrom) query.issuedAt.$gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
      if (filters.dateTo) query.issuedAt.$lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
    }

    if (filters.customerId || filters.producerId) {
      const salesOrderQuery: FilterQuery<SalesOrder> = { isDeleted: false };
      const purchaseOrderQuery: FilterQuery<PurchaseOrder> = { isDeleted: false };
      
      if (filters.customerId) {
        salesOrderQuery.customerId = new Types.ObjectId(filters.customerId);
      }
      if (filters.producerId) {
        salesOrderQuery.producerId = new Types.ObjectId(filters.producerId);
        purchaseOrderQuery.producerId = new Types.ObjectId(filters.producerId);
      }
      
      const salesOrders = await this.salesOrderModel.find(salesOrderQuery).select('_id').lean();
      const purchaseOrders = await this.purchaseOrderModel.find(purchaseOrderQuery).select('_id').lean();
      
      query.$or = [
        { salesOrderId: { $in: salesOrders.map((order) => order._id) } },
        { purchaseOrderId: { $in: purchaseOrders.map((order) => order._id) } }
      ];
    }

    return query;
  }

  private async findOrder(salesOrderId?: string | Types.ObjectId, purchaseOrderId?: string | Types.ObjectId) {
    if (salesOrderId) {
      const salesOrder = await this.salesOrderModel.findOne({ _id: salesOrderId, isDeleted: false });
      if (salesOrder) return salesOrder;
    }
    if (purchaseOrderId) {
      const purchaseOrder = await this.purchaseOrderModel.findOne({ _id: purchaseOrderId, isDeleted: false });
      if (purchaseOrder) return purchaseOrder;
    }
    throw new NotFoundException('Venda ou compra nao encontrada para vinculo fiscal.');
  }

  private resolveStatus(status: string | undefined, amount: number | undefined, order: SalesOrder | PurchaseOrder) {
    if (status === 'cancelled') {
      return 'cancelled';
    }
    if (amount === undefined || amount === null) {
      return status === 'issued' ? 'issued' : 'pending';
    }

    let isMatch = false;
    if ('totalReceivableAmount' in order) {
      const amountMatchesReceivable = Math.abs(amount - ((order as any).totalReceivableAmount ?? 0)) <= FISCAL_TOLERANCE;
      const amountMatchesParticular = Math.abs(amount - ((order as any).totalParticularAmount ?? 0)) <= FISCAL_TOLERANCE;
      isMatch = amountMatchesReceivable || amountMatchesParticular;
    } else {
      const amountMatchesTotal = Math.abs(amount - (order.totalAmount ?? 0)) <= FISCAL_TOLERANCE;
      isMatch = amountMatchesTotal;
    }
    
    if (!isMatch) {
      return 'divergent';
    }
    return status === 'pending' ? 'pending' : 'issued';
  }

  private async updateOrderFiscalStatus(order: SalesOrder | PurchaseOrder, fiscalStatus: string) {
    if ('totalReceivableAmount' in order) {
      await this.salesOrderModel.findByIdAndUpdate((order as any)._id, { fiscalStatus });
    } else {
      await this.purchaseOrderModel.findByIdAndUpdate((order as any)._id, { fiscalStatus });
    }
  }

  private resolveFileKind(mimeType: string, originalName: string): FiscalFileKind {
    const extension = extname(originalName).toLowerCase();
    if (mimeType === 'application/pdf' || extension === '.pdf') return 'danfe_pdf';
    if (mimeType === 'application/xml' || mimeType === 'text/xml' || extension === '.xml') return 'xml';
    if (['image/png', 'image/jpg', 'image/jpeg'].includes(mimeType) || ['.png', '.jpg', '.jpeg'].includes(extension)) {
      return 'image';
    }
    return 'other';
  }
}
