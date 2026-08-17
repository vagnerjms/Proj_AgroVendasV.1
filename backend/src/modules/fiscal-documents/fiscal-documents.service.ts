import { BadRequestException, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { basename, extname, join } from 'path';
import { FilterQuery, Model, Types } from 'mongoose';
import { PurchaseOrder, PurchaseOrderDocument } from '../purchase-orders/schemas/purchase-order.schema';
import { SalesOrder, SalesOrderDocument } from '../sales-orders/schemas/sales-order.schema';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import { UpdateFiscalDocumentDto } from './dto/update-fiscal-document.dto';
import { FiscalDocument, FiscalFileKind } from './schemas/fiscal-document.schema';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { FiscalDocumentExtractionService } from './fiscal-document-extraction.service';

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
export class FiscalDocumentsService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(FiscalDocument.name) private readonly fiscalDocumentModel: Model<FiscalDocument>,
    @InjectModel(SalesOrder.name) private readonly salesOrderModel: Model<SalesOrderDocument>,
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    private readonly salesOrdersService: SalesOrdersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly extractionService: FiscalDocumentExtractionService,
  ) {}

  async onApplicationBootstrap() {
    console.log('FiscalDocumentsService: Iniciando sincronização automática de vendas com as notas...');
    try {
      await this.restoreDatabaseAndCleanup();
      await this.backfillExtractedData();
      await this.syncSalesToNfe();
    } catch (err) {
      console.error('Erro na sincronização automática de notas fiscais:', err);
    }
  }

  async restoreDatabaseAndCleanup() {
    const salesOrderModel = this.fiscalDocumentModel.db.model('SalesOrder');
    const customerModel = this.fiscalDocumentModel.db.model('Customer');
    const fiscalDocModel = this.fiscalDocumentModel;

    console.log('FiscalDocumentsService: Iniciando limpeza de vendas duplicadas e restauração de links...');

    // 1. Encontrar todas as vendas duplicadas criadas com código VPXXX
    const duplicateOrders = await salesOrderModel.find({
      orderNumber: { $regex: /^VP\d+/ },
      isDeleted: false
    }).lean();

    const duplicateOrderIds = duplicateOrders.map(o => o._id.toString());
    if (duplicateOrders.length === 0) {
      console.log('FiscalDocumentsService: Nenhuma venda duplicada VPXXX encontrada no banco para limpar.');
      return;
    }
    console.log(`FiscalDocumentsService: Encontradas ${duplicateOrders.length} vendas duplicadas para remoção.`);

    // 2. Buscar todas as notas fiscais vinculadas a essas vendas duplicadas
    const fiscalDocs = await fiscalDocModel.find({
      salesOrderId: { $in: duplicateOrderIds.map(id => new Types.ObjectId(id)) },
      isDeleted: false
    }).exec();

    console.log(`FiscalDocumentsService: Encontrados ${fiscalDocs.length} documentos fiscais para restaurar.`);

    // Buscar todas as vendas originais ativas no sistema
    const originalOrders = await salesOrderModel.find({
      orderNumber: { $not: { $regex: /^VP\d+/ } },
      isDeleted: false
    }).lean();

    let restoredCount = 0;
    for (const doc of fiscalDocs) {
      // Encontrar a melhor venda original correspondente
      let bestOrder = null;
      let bestScore = -1;

      for (const order of originalOrders) {
        let score = 0;

        // Regra 1: Mesmo Cliente
        const dupOrder = duplicateOrders.find(o => o._id.toString() === doc.salesOrderId?.toString());
        if (dupOrder && order.customerId) {
          const customerNew = await customerModel.findById(dupOrder.customerId).lean() as any;
          const customerOrg = await customerModel.findById(order.customerId).lean() as any;
          if (customerNew && customerOrg && customerNew.name.split(' ')[0].toLowerCase() === customerOrg.name.split(' ')[0].toLowerCase()) {
            score += 100;
          }
        }

        // Regra 2: Diferença de Data (máximo de 3 dias de diferença)
        const orderTime = new Date(order.date).getTime();
        const docTime = new Date(doc.issuedAt).getTime();
        const diffDays = Math.abs(orderTime - docTime) / (1000 * 60 * 60 * 24);
        if (diffDays <= 3) {
          score += (3 - diffDays) * 10;
        } else {
          score -= 50;
        }

        // Regra 3: Peso líquido da nota (kg)
        const weightDiff = Math.abs((order.totalKg || 0) - (doc.totalWeightKg || 0));
        if (weightDiff < 10) {
          score += 50;
        } else if (weightDiff < 500) {
          score += 20;
        }

        // Regra 4: Valor total da operação
        const amountDiff = Math.abs((order.totalParticularAmount || 0) - (doc.amount || 0));
        if (amountDiff < 10) {
          score += 30;
        } else if (amountDiff < 2000) {
          score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestOrder = order;
        }
      }

      if (bestOrder && bestScore > 50) {
        console.log(`FiscalDocumentsService: Restaurando nota ${doc.number} para a venda original ${bestOrder.orderNumber} (score: ${bestScore})`);
        
        await fiscalDocModel.updateOne(
          { _id: doc._id },
          {
            $set: {
              salesOrderId: bestOrder._id,
              orderNumber: bestOrder.orderNumber
            }
          }
        );

        await this.salesOrdersService.recalculateFinancials(bestOrder._id.toString());
        restoredCount++;
      } else {
        console.log(`FiscalDocumentsService: Não foi possível encontrar uma venda correspondente para a nota ${doc.number}`);
      }
    }

    // 3. Deletar as vendas duplicadas definitivamente
    const deleteResult = await salesOrderModel.deleteMany({
      _id: { $in: duplicateOrderIds.map(id => new Types.ObjectId(id)) }
    });

    console.log(`FiscalDocumentsService: Deletadas ${deleteResult.deletedCount} vendas duplicadas do banco.`);
    console.log(`FiscalDocumentsService: Restauração concluída! ${restoredCount} notas fiscais foram reassociadas.`);
  }

  async backfillExtractedData() {
    const docs = await this.fiscalDocumentModel.find({
      isDeleted: false,
      files: { $exists: true, $not: { $size: 0 } },
      $or: [
        { totalWeightKg: { $exists: false } },
        { totalWeightKg: null },
        { totalWeightKg: 0 }
      ]
    }).exec();

    if (docs.length === 0) return;

    console.log(`FiscalDocumentsService: Encontradas ${docs.length} notas antigas sem peso para extração retroativa.`);
    
    let successCount = 0;
    for (const doc of docs) {
      const file = doc.files[0];
      if (!file || !file.storagePath || !existsSync(file.storagePath)) {
        continue;
      }
      
      try {
        const extracted = this.extractionService.extract(file.storagePath, file.originalName);
        if (extracted.totalWeightKg && extracted.totalWeightKg > 0) {
          await this.fiscalDocumentModel.updateOne({ _id: doc._id }, {
            $set: {
              items: extracted.items,
              totalWeightKg: extracted.totalWeightKg,
              unitPrice: extracted.unitPrice,
              unitPriceRaw: extracted.unitPriceRaw,
              amountRaw: extracted.amountRaw,
              weightDecimalPlaces: extracted.weightDecimalPlaces,
              unitPriceDecimalPlaces: extracted.unitPriceDecimalPlaces,
              amountDecimalPlaces: extracted.amountDecimalPlaces,
              extractionMethod: extracted.method,
              extractionConfidence: extracted.confidence
            }
          });
          successCount++;
        }
      } catch (err: any) {
        console.error(`Erro ao re-extrair peso da nota ${doc.number} (${doc._id}):`, err.message);
      }
    }
    if (successCount > 0) {
      console.log(`FiscalDocumentsService: Extração retroativa concluída com sucesso para ${successCount} notas.`);
    }
  }

  async syncSalesToNfe() {
    const fiscalDocs = await this.fiscalDocumentModel.find({ 
      isDeleted: false, 
      salesOrderId: { $exists: true, $ne: null },
      status: { $ne: 'cancelled' } 
    }).exec();

    let updatedCount = 0;
    for (const doc of fiscalDocs) {
      if (!doc.salesOrderId || !doc.amount || doc.amount <= 0) {
        continue;
      }

      const orderId = doc.salesOrderId.toString();
      const salesOrder = await this.salesOrderModel.findOne({ _id: orderId, isDeleted: false }).exec();
      if (!salesOrder) continue;

      const currentAmount = salesOrder.totalParticularAmount || 0;
      const targetAmount = doc.amount;
      const currentWeight = salesOrder.totalKg || 0;
      const targetWeight = doc.totalWeightKg || 0;

      const valueDivergent = Math.abs(currentAmount - targetAmount) > 0.01;
      const weightDivergent = targetWeight > 0 && Math.abs(currentWeight - targetWeight) > 0.01;

      if (valueDivergent || weightDivergent) {
        console.log(`Auto-Sync: Ajustando venda ${salesOrder.orderNumber} (Valor OP: ${currentAmount} -> NF: ${targetAmount} | Peso OP: ${currentWeight} -> NF: ${targetWeight})`);
        await this.adjustOrderAmount(orderId, undefined, targetAmount, doc.totalWeightKg);
        await this.salesOrdersService.recalculateFinancials(orderId);
        await this.fiscalDocumentModel.findByIdAndUpdate(doc._id, { status: 'issued' });
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`FiscalDocumentsService: Sincronizadas ${updatedCount} vendas com suas notas com sucesso.`);
    }
  }

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

  private async adjustOrderAmount(sId?: string, pId?: string, amount?: number, totalWeightKg?: number) {
    if (!amount || amount <= 0) return;
    if (sId) {
      const salesOrder = await this.salesOrderModel.findOne({ _id: sId, isDeleted: false });
      if (salesOrder && salesOrder.items?.length > 0) {
        const item = salesOrder.items[0];
        const bagWeight = item.bagWeightKg || 25;
        let qtyKg = totalWeightKg || 0;
        if (qtyKg <= 0) {
          const pricePerBag = item.pricePerBag || 1;
          const qtyBags = Math.round((amount / pricePerBag) * 1000) / 1000;
          qtyKg = Math.round(qtyBags * bagWeight * 1000) / 1000;
        }
        const qtyBags = Math.round((qtyKg / bagWeight) * 1000) / 1000;
        item.quantityKg = qtyKg;
        item.quantityBags = qtyBags;
        if (qtyBags > 0) {
          item.pricePerBag = Math.round((amount / qtyBags) * 10000) / 10000;
          item.lineTotal = Math.round(qtyBags * item.pricePerBag * 100) / 100;
        }
        await salesOrder.save();
      }
    } else if (pId) {
      const purchaseOrder = await this.purchaseOrderModel.findOne({ _id: pId, isDeleted: false });
      if (purchaseOrder && purchaseOrder.items?.length > 0) {
        const item = purchaseOrder.items[0];
        const bagWeight = item.bagWeightKg || 25;
        let qtyKg = totalWeightKg || 0;
        if (qtyKg <= 0) {
          const costPerBag = item.costPerBag || 1;
          const qtyBags = Math.round((amount / costPerBag) * 1000) / 1000;
          qtyKg = Math.round(qtyBags * bagWeight * 1000) / 1000;
        }
        const qtyBags = Math.round((qtyKg / bagWeight) * 1000) / 1000;
        item.quantityKg = qtyKg;
        item.quantityBags = qtyBags;
        if (qtyBags > 0) {
          item.costPerBag = Math.round((amount / qtyBags) * 10000) / 10000;
          item.lineTotal = Math.round(qtyBags * item.costPerBag * 100) / 100;
        }
        await purchaseOrder.save();
      }
    }
  }

  async create(dto: CreateFiscalDocumentDto) {
    if (!dto.salesOrderId && !dto.purchaseOrderId) {
      throw new BadRequestException('Venda ou compra deve ser informada.');
    }
    const sId = dto.salesOrderId;
    const pId = dto.purchaseOrderId;
    if (dto.adjustOrderAmount && dto.amount && dto.amount > 0) {
      await this.adjustOrderAmount(sId, pId, dto.amount, dto.totalWeightKg);
    }
    const order = await this.findOrder(sId, pId);
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

    const sId = dto.salesOrderId ?? existing.salesOrderId?.toString();
    const pId = dto.purchaseOrderId ?? existing.purchaseOrderId?.toString();
    const nextAmount = dto.amount ?? existing.amount;

    if (dto.adjustOrderAmount && nextAmount !== undefined && nextAmount > 0) {
      const nextWeight = dto.totalWeightKg !== undefined ? dto.totalWeightKg : existing.totalWeightKg;
      await this.adjustOrderAmount(sId, pId, nextAmount, nextWeight);
    }

    const order = await this.findOrder(sId, pId);
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
    const saved = await fiscalDocument.save();

    try {
      const extracted = this.extractionService.extract(targetPath, file.originalname);
      await this.fiscalDocumentModel.updateOne({ _id: fiscalDocument._id }, {
        $set: {
          items: extracted.items,
          number: extracted.number || fiscalDocument.number,
          accessKey: extracted.accessKey || fiscalDocument.accessKey,
          amount: extracted.amount,
          amountRaw: extracted.amountRaw,
          unitPrice: extracted.unitPrice,
          unitPriceRaw: extracted.unitPriceRaw,
          totalWeightKg: extracted.totalWeightKg,
          totalWeightRaw: extracted.totalWeightRaw,
          weightDecimalPlaces: extracted.weightDecimalPlaces,
          unitPriceDecimalPlaces: extracted.unitPriceDecimalPlaces,
          amountDecimalPlaces: extracted.amountDecimalPlaces,
          extractionMethod: extracted.method,
          extractionConfidence: extracted.confidence,
          extractionError: undefined,
          status: extracted.amount !== undefined ? 'issued' : 'divergent',
        },
      });
      if (fiscalDocument.adjustOrderAmount && extracted.amount && extracted.amount > 0) {
        await this.adjustOrderAmount(
          fiscalDocument.salesOrderId?.toString(),
          fiscalDocument.purchaseOrderId?.toString(),
          extracted.amount,
          extracted.totalWeightKg,
        );
      }
      if (fiscalDocument.salesOrderId) await this.salesOrdersService.recalculateFinancials(fiscalDocument.salesOrderId.toString());
    } catch (error: any) {
      await this.fiscalDocumentModel.updateOne({ _id: fiscalDocument._id }, {
        $set: { extractionMethod: 'none', extractionConfidence: 0, extractionError: error?.message || 'Falha na extração fiscal', status: 'divergent' },
      });
    }

    // Disparar Webhook para n8n em segundo plano
    const newFile = saved.files[saved.files.length - 1];
    const fileId = (newFile as any)._id?.toString() || '';

    this.findOrderWithPartners(fiscalDocument.salesOrderId, fiscalDocument.purchaseOrderId)
      .then((order) => {
        const partnerName = 'customerId' in order
          ? ((order.customerId as any)?.name || 'Cliente')
          : ((order.producerId as any)?.name || 'Produtor');
          
        this.triggerWebhook({
          orderNumber: fiscalDocument.orderNumber,
          partnerName,
          fileType: 'nota_fiscal',
          originalName: file.originalname,
          downloadUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://179.197.231.106:3001'}/fiscal-documents/${fiscalDocument._id}/files/${fileId}/download?apiKey=${process.env.API_KEY || 'AgroVendas_n8n_Secret_Key_2026'}`
        });
      })
      .catch(err => console.error('Erro ao disparar webhook para n8n:', err));

    return fileEntry;
  }

  private async findOrderWithPartners(salesOrderId?: string | Types.ObjectId, purchaseOrderId?: string | Types.ObjectId) {
    if (salesOrderId) {
      const salesOrder = await this.salesOrderModel.findOne({ _id: salesOrderId, isDeleted: false }).populate('customerId producerId').lean();
      if (salesOrder) return salesOrder;
    }
    if (purchaseOrderId) {
      const purchaseOrder = await this.purchaseOrderModel.findOne({ _id: purchaseOrderId, isDeleted: false }).populate('producerId').lean();
      if (purchaseOrder) return purchaseOrder;
    }
    throw new NotFoundException('Venda ou compra nao encontrada para vinculo fiscal.');
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

  async removeFile(id: string, fileId: string) {
    const fiscalDocument = await this.fiscalDocumentModel.findOne({ _id: id, isDeleted: false });
    if (!fiscalDocument) {
      throw new NotFoundException('Documento fiscal nao encontrado.');
    }

    const fileIndex = fiscalDocument.files.findIndex((entry) => {
      const entryWithId = entry as any;
      return entryWithId._id?.toString() === fileId;
    });

    if (fileIndex === -1) {
      throw new NotFoundException('Arquivo fiscal nao encontrado no documento.');
    }

    const file = fiscalDocument.files[fileIndex];
    
    // Deletar o arquivo do disco
    if (file.storagePath && existsSync(file.storagePath)) {
      try {
        unlinkSync(file.storagePath);
      } catch (err) {
        // Ignorar se não conseguir deletar o físico
      }
    }

    // Remover da lista e salvar
    fiscalDocument.files.splice(fileIndex, 1);
    await fiscalDocument.save();

    return { success: true };
  }

  private async buildQuery(filters: FiscalFilters) {
    const query: FilterQuery<FiscalDocument> = {
      $and: [
        { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] },
      ],
    };
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
      
      query.$and!.push({ $or: [
        { salesOrderId: { $in: salesOrders.map((order) => order._id) } },
        { purchaseOrderId: { $in: purchaseOrders.map((order) => order._id) } }
      ] });
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
