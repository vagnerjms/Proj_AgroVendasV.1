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
      await this.importSalesFromJson();
      await this.backfillExtractedData();
      await this.syncSalesToNfe();
    } catch (err) {
      console.error('Erro na sincronização automática de notas fiscais:', err);
    }
  }

  async importSalesFromJson() {
    const customerModel = this.fiscalDocumentModel.db.model('Customer');
    const producerModel = this.fiscalDocumentModel.db.model('Producer');
    const productModel = this.fiscalDocumentModel.db.model('Product');

    const jsonData = {
      "sales": [
        {
          "id": "VP001",
          "date": "2026-07-18",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 21530.0,
          "bags": 742.41,
          "price_per_bag": 45.0,
          "total_value": 33408.62,
          "due_date": "2026-08-27",
          "invoice_number": "27957662"
        },
        {
          "id": "VP002",
          "date": "2026-07-18",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 19240.0,
          "bags": 663.45,
          "price_per_bag": 45.0,
          "total_value": 29855.17,
          "due_date": "2026-08-27",
          "invoice_number": "27957664"
        },
        {
          "id": "VP003",
          "date": "2026-07-18",
          "customer": "Comercial de Verduras WD LTDA",
          "weight_kg": 19285.0,
          "bags": 665.0,
          "price_per_bag": 45.0,
          "total_value": 29875.0,
          "due_date": "2026-08-27",
          "invoice_number": "27957569"
        },
        {
          "id": "VP004",
          "date": "2026-07-21",
          "customer": "Marcelo Katsumi Harada (Tayo)",
          "weight_kg": 18200.0,
          "bags": 627.59,
          "price_per_bag": 45.0,
          "total_value": 28241.38,
          "due_date": "2026-08-30",
          "invoice_number": "27967571"
        },
        {
          "id": "VP006",
          "date": "2026-07-27",
          "customer": "Badin Favilla Hortifruti LTDA",
          "weight_kg": 15810.0,
          "bags": 545.17,
          "price_per_bag": 40.0,
          "total_value": 21806.9,
          "due_date": "2026-09-05",
          "invoice_number": "27980432"
        },
        {
          "id": "VP007",
          "date": "2026-07-21",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 22560.0,
          "bags": 777.93,
          "price_per_bag": 42.0,
          "total_value": 32673.1,
          "due_date": "2026-08-30",
          "invoice_number": "27970562"
        },
        {
          "id": "VP008",
          "date": "2026-07-22",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 19960.0,
          "bags": 688.28,
          "price_per_bag": 40.0,
          "total_value": 27531.03,
          "due_date": "2026-08-31",
          "invoice_number": "27980429"
        },
        {
          "id": "VP009",
          "date": "2026-07-24",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 19890.0,
          "bags": 685.86,
          "price_per_bag": 45.0,
          "total_value": 30863.79,
          "due_date": "2026-09-02",
          "invoice_number": "27998942"
        },
        {
          "id": "VP010",
          "date": "2026-07-22",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 20300.0,
          "bags": 700.0,
          "price_per_bag": 40.0,
          "total_value": 28000.0,
          "due_date": "2026-08-31",
          "invoice_number": "27977672"
        },
        {
          "id": "VP011",
          "date": "2026-07-26",
          "customer": "Badin Favilla Hortifruti LTDA",
          "weight_kg": 15998.0,
          "bags": 551.66,
          "price_per_bag": 45.0,
          "total_value": 24824.48,
          "due_date": "2026-09-04",
          "invoice_number": "27999695"
        },
        {
          "id": "VP012",
          "date": "2026-07-24",
          "customer": "Comercial de Verduras WD LTDA",
          "weight_kg": 11252.0,
          "bags": 388.0,
          "price_per_bag": 45.0,
          "total_value": 17460.0,
          "due_date": "2026-09-02",
          "invoice_number": "27999696"
        },
        {
          "id": "VP013",
          "date": "2026-07-27",
          "customer": "Marcelo Katsumi Harada (Tayo)",
          "weight_kg": 28120.0,
          "bags": 969.66,
          "price_per_bag": 55.0,
          "total_value": 53331.03,
          "due_date": "2026-09-05",
          "invoice_number": "28008239"
        },
        {
          "id": "VP014",
          "date": "2026-07-27",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 20240.0,
          "bags": 697.93,
          "price_per_bag": 55.0,
          "total_value": 38386.15,
          "due_date": "2026-09-05",
          "invoice_number": "28003902"
        },
        {
          "id": "VP015",
          "date": "2026-07-27",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 16530.0,
          "bags": 570.0,
          "price_per_bag": 55.0,
          "total_value": 31350.0,
          "due_date": "2026-09-05",
          "invoice_number": "28007928"
        },
        {
          "id": "VP016",
          "date": "2026-07-28",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 16720.0,
          "bags": 576.0,
          "price_per_bag": 55.0,
          "total_value": 31680.0,
          "due_date": "2026-09-06",
          "invoice_number": "28017539"
        },
        {
          "id": "VP017",
          "date": "2026-07-28",
          "customer": "Comercial de Verduras Azevedo LTDA",
          "weight_kg": 18240.0,
          "bags": 629.0,
          "price_per_bag": 55.0,
          "total_value": 34595.0,
          "due_date": "2026-09-06",
          "invoice_number": "28017525"
        },
        {
          "id": "VP018",
          "date": "2026-07-29",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 15900.0,
          "bags": 548.0,
          "price_per_bag": 55.0,
          "total_value": 30140.0,
          "due_date": "2026-09-07",
          "invoice_number": "28021552"
        },
        {
          "id": "VP019",
          "date": "2026-07-30",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 19200.0,
          "bags": 662.07,
          "price_per_bag": 62.0,
          "total_value": 41048.28,
          "due_date": "2026-09-08",
          "invoice_number": "28033001"
        },
        {
          "id": "VP020",
          "date": "2026-08-01",
          "customer": "Comercial de Verduras WD LTDA",
          "weight_kg": 10644.0,
          "bags": 367.0,
          "price_per_bag": 65.0,
          "total_value": 23855.0,
          "due_date": "2026-09-10",
          "invoice_number": "28042907"
        },
        {
          "id": "VP021",
          "date": "2026-08-01",
          "customer": "Badin Favilla Hortifruti LTDA",
          "weight_kg": 15135.0,
          "bags": 521.9,
          "price_per_bag": 65.0,
          "total_value": 33923.28,
          "due_date": "2026-09-10",
          "invoice_number": "28042900"
        },
        {
          "id": "VP022",
          "date": "2026-08-01",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 18610.0,
          "bags": 641.72,
          "price_per_bag": 60.0,
          "total_value": 38503.45,
          "due_date": "2026-09-10",
          "invoice_number": "28042894"
        },
        {
          "id": "VP023",
          "date": "2026-08-01",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 22388.0,
          "bags": 772.0,
          "price_per_bag": 65.0,
          "total_value": 50180.0,
          "due_date": "2026-09-10",
          "invoice_number": "28042638"
        },
        {
          "id": "VP024",
          "date": "2026-08-03",
          "customer": "Hortifruti Rubi LTDA",
          "weight_kg": 19580.0,
          "bags": 675.17,
          "price_per_bag": 65.0,
          "total_value": 43886.21,
          "due_date": "2026-09-12",
          "invoice_number": "28047798"
        },
        {
          "id": "VP025",
          "date": "2026-08-03",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 18870.0,
          "bags": 650.69,
          "price_per_bag": 65.0,
          "total_value": 42294.83,
          "due_date": "2026-09-12",
          "invoice_number": "28053397"
        },
        {
          "id": "VP026",
          "date": "2026-08-03",
          "customer": "Comercial de Verduras Azevedo LTDA",
          "weight_kg": 20540.0,
          "bags": 708.28,
          "price_per_bag": 65.0,
          "total_value": 46037.93,
          "due_date": "2026-09-12",
          "invoice_number": "28053399"
        },
        {
          "id": "VP027",
          "date": "2026-08-04",
          "customer": "Marcelo Katsumi Harada (Tayo)",
          "weight_kg": 19740.0,
          "bags": 680.69,
          "price_per_bag": 65.0,
          "total_value": 44244.83,
          "due_date": "2026-09-13",
          "invoice_number": "28058820"
        },
        {
          "id": "VP028",
          "date": "2026-08-05",
          "customer": "W & A Distribuidora de Verduras LTDA",
          "weight_kg": 18680.0,
          "bags": 644.14,
          "price_per_bag": 65.0,
          "total_value": 41868.97,
          "due_date": "2026-09-14",
          "invoice_number": "28069150"
        },
        {
          "id": "VP029",
          "date": "2026-08-05",
          "customer": "Hort Bom Alimentos LTD",
          "weight_kg": 21100.0,
          "bags": 727.59,
          "price_per_bag": 65.0,
          "total_value": 47293.1,
          "due_date": "2026-09-14",
          "invoice_number": "28069166"
        }
      ]
    };

    // Buscar produtor padrão
    let producer = await producerModel.findOne({ isDeleted: false });
    if (!producer) {
      producer = await producerModel.create({ name: 'Produtor Padrão' });
    }

    // Buscar produto padrão
    let product = await productModel.findOne({ isDeleted: false });
    if (!product) {
      product = await productModel.create({ name: 'CENOURA', basePrice: 40 });
    }

    console.log(`FiscalDocumentsService: Iniciando importação automática de ${jsonData.sales.length} vendas do JSON...`);
    let successCount = 0;

    for (const sale of jsonData.sales) {
      let salesOrder = await this.salesOrderModel.findOne({ orderNumber: sale.id, isDeleted: false });
      
      if (!salesOrder) {
        // Buscar ou criar cliente
        let searchName = sale.customer.split(' ')[0];
        let customer = await customerModel.findOne({ name: { $regex: searchName, $options: 'i' }, isDeleted: false });
        if (!customer) {
          customer = await customerModel.create({
            name: sale.customer,
            documentType: 'cnpj',
            documentNumber: '00000000000000',
            city: 'Desconhecida',
            state: 'GO'
          });
        }

        salesOrder = await this.salesOrderModel.create({
          orderNumber: sale.id,
          saleType: 'particular',
          status: 'confirmed',
          date: new Date(sale.date),
          customerId: customer._id,
          producerId: producer._id,
          items: [
            {
              productId: product._id,
              quantityBags: sale.bags,
              bagWeightKg: 29,
              quantityKg: sale.weight_kg,
              pricePerBag: sale.price_per_bag,
              lineTotal: sale.total_value,
            }
          ],
          dueDate: new Date(sale.due_date),
          dueDateManual: true
        });
      } else {
        // Atualizar itens
        salesOrder.items = [
          {
            productId: product._id,
            quantityBags: sale.bags,
            bagWeightKg: 29,
            quantityKg: sale.weight_kg,
            pricePerBag: sale.price_per_bag,
            lineTotal: sale.total_value,
          }
        ];
        salesOrder.date = new Date(sale.date);
        salesOrder.dueDate = new Date(sale.due_date);
        salesOrder.dueDateManual = true;
        await salesOrder.save();
      }

      const orderId = salesOrder._id.toString();
      await this.salesOrdersService.recalculateFinancials(orderId);

      // Buscar ou criar documento fiscal
      let fiscalDoc = await this.fiscalDocumentModel.findOne({ number: sale.invoice_number, isDeleted: false });
      if (!fiscalDoc) {
        fiscalDoc = await this.fiscalDocumentModel.create({
          salesOrderId: salesOrder._id,
          orderNumber: salesOrder.orderNumber,
          number: sale.invoice_number,
          amount: sale.total_value,
          totalWeightKg: sale.weight_kg,
          status: 'issued',
          adjustOrderAmount: true,
          issuedAt: new Date(sale.date),
          files: []
        });
      } else {
        await this.fiscalDocumentModel.updateOne(
          { _id: fiscalDoc._id },
          {
            $set: {
              salesOrderId: salesOrder._id,
              orderNumber: salesOrder.orderNumber,
              amount: sale.total_value,
              totalWeightKg: sale.weight_kg,
              status: 'issued',
              adjustOrderAmount: true,
              issuedAt: new Date(sale.date)
            }
          }
        );
      }
      successCount++;
    }
    console.log(`FiscalDocumentsService: Importados/Sincronizados com sucesso ${successCount} lançamentos do JSON.`);
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
