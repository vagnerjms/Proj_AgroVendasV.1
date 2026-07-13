import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto);
  }

  @Get()
  findAll() {
    return this.purchaseOrdersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }

  @Post('draft')
  createDraft(@Body('date') date: string) {
    return this.purchaseOrdersService.createDraft(date);
  }

  @Post('calculate')
  calculate(@Body() input: any) {
    // Simply proxy to service if we had one, or calculate here
    const items = (input.items || []).map((item: any) => {
      const quantityKg = Math.round((item.quantityBags || 0) * (item.bagWeightKg || 25) * 1000) / 1000;
      const lineTotal = Math.round((item.quantityBags || 0) * (item.costPerBag || 0) * 100) / 100;
      return { ...item, quantityKg, lineTotal };
    });

    const totalBags = items.reduce((acc: number, item: any) => acc + item.quantityBags, 0);
    const totalKg = items.reduce((acc: number, item: any) => acc + item.quantityKg, 0);
    const totalAmount = items.reduce((acc: number, item: any) => acc + item.lineTotal, 0);

    const funruralRate = input.funruralRate ?? 0.015;
    const funruralSocialSecurityRate = input.funruralSocialSecurityRate ?? 0.012;
    const funruralRatRate = input.funruralRatRate ?? 0.001;
    const funruralSenarRate = input.funruralSenarRate ?? 0.002;

    const funruralSocialSecurityAmount = Math.round(totalAmount * funruralSocialSecurityRate * 100) / 100;
    const funruralRatAmount = Math.round(totalAmount * funruralRatRate * 100) / 100;
    const funruralSenarAmount = Math.round(totalAmount * funruralSenarRate * 100) / 100;
    const funruralRetentionAmount = Math.round(totalAmount * funruralRate * 100) / 100;

    const producerNetAmount = Math.round((totalAmount - funruralRetentionAmount) * 100) / 100;

    return {
      items,
      totalBags,
      totalKg,
      totalAmount,
      funruralRate,
      funruralSocialSecurityRate,
      funruralRatRate,
      funruralSenarRate,
      funruralSocialSecurityAmount,
      funruralRatAmount,
      funruralSenarAmount,
      funruralRetentionAmount,
      producerNetAmount,
    };
  }
}
