import { Injectable } from '@nestjs/common';
import { CalculateSalesOrderDto } from './dto/calculate-sales-order.dto';

@Injectable()
export class SalesOrderCalculationService {
  calculate(input: CalculateSalesOrderDto) {
    const saleType = (input as any).saleType ?? 'particular';

    const items = (input.items ?? []).map((item) => {
      const bagWeightKg = item.bagWeightKg ?? 25;
      const quantityBags = item.quantityBags ?? 0;
      const pricePerBag = item.pricePerBag ?? 0;
      const costPerBag = (item as any).costPerBag ?? 0;
      const quantityKg = this.roundQuantity(quantityBags * bagWeightKg);
      const lineTotal = this.roundMoney(quantityBags * pricePerBag);
      const lineCostTotal = this.roundMoney(quantityBags * costPerBag);

      return {
        productId: (item as any).productId,
        quantityBags,
        bagWeightKg,
        quantityKg,
        pricePerBag,
        lineTotal,
        costPerBag,
        lineCostTotal,
      };
    });

    const totalBags = this.roundQuantity(items.reduce((sum, item) => sum + item.quantityBags, 0));
    const totalKg = this.roundQuantity(items.reduce((sum, item) => sum + item.quantityKg, 0));
    const totalParticularAmount = this.roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const totalCostAmount = this.roundMoney(items.reduce((sum, item) => sum + item.lineCostTotal, 0));

    const funruralRate = input.funruralRate ?? 0.0163;
    const funruralSocialSecurityRate = input.funruralSocialSecurityRate ?? 0.013;
    const funruralRatRate = input.funruralRatRate ?? 0.001;
    const funruralSenarRate = input.funruralSenarRate ?? 0.0023;

    // Tax is always calculated on faturamento (sale price) since the client PJ retains it on our invoice
    const baseAmountValue = totalParticularAmount;
    const taxBaseAmount = (input.nfeTotalAmount && input.nfeTotalAmount > 0) ? input.nfeTotalAmount : baseAmountValue;

    const funruralSocialSecurityAmount = this.roundMoney(taxBaseAmount * funruralSocialSecurityRate);
    const funruralRatAmount = this.roundMoney(taxBaseAmount * funruralRatRate);
    const funruralSenarAmount = this.roundMoney(taxBaseAmount * funruralSenarRate);
    const funruralRetentionAmount = this.roundMoney(taxBaseAmount * funruralRate);

    let totalReceivableAmount = 0;
    let producerNetAmount = 0;
    let marginAmount = 0;
    let brokerageAmount = 0;

    const brokerageFeeType = (input as any).brokerageFeeType;
    const brokerageFeeValue = (input as any).brokerageFeeValue || 0;
    
    if (brokerageFeeType === 'fixed') {
      brokerageAmount = this.roundMoney(totalBags * brokerageFeeValue);
    } else if (brokerageFeeType === 'percentage') {
      brokerageAmount = this.roundMoney(totalParticularAmount * (brokerageFeeValue / 100));
    }

    const customerDocumentType = (input as any).customerDocumentType ?? 'cnpj';
    const isClientPJ = customerDocumentType === 'cnpj';

    if (saleType === 'compra_venda') {
      if (isClientPJ) {
        totalReceivableAmount = this.roundMoney(totalParticularAmount - funruralRetentionAmount);
      } else {
        totalReceivableAmount = totalParticularAmount;
      }
      producerNetAmount = totalCostAmount; // Paga 100% ao produtor (sem retenção CPF-para-CPF)
      marginAmount = this.roundMoney(totalReceivableAmount - totalCostAmount);
    } else if (saleType === 'venda_estoque') {
      if (isClientPJ) {
        totalReceivableAmount = this.roundMoney(totalParticularAmount - funruralRetentionAmount);
      } else {
        totalReceivableAmount = totalParticularAmount;
      }
      producerNetAmount = 0;
      marginAmount = this.roundMoney(totalReceivableAmount - totalCostAmount);
    } else {
      if (isClientPJ) {
        totalReceivableAmount = this.roundMoney(totalParticularAmount - funruralRetentionAmount);
      } else {
        totalReceivableAmount = totalParticularAmount;
      }
      producerNetAmount = totalCostAmount;
      marginAmount = this.roundMoney(totalReceivableAmount - totalCostAmount);
    }

    return {
      items,
      totalBags,
      totalKg,
      totalParticularAmount,
      totalCostAmount,
      funruralRate,
      funruralSocialSecurityRate,
      funruralRatRate,
      funruralSenarRate,
      funruralSocialSecurityAmount,
      funruralRatAmount,
      funruralSenarAmount,
      funruralRetentionAmount,
      totalReceivableAmount,
      producerNetAmount,
      marginAmount,
      brokerageAmount,
      brokerageFeeType,
      brokerageFeeValue,
      brokeragePayer: (input as any).brokeragePayer,
    };
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private roundQuantity(value: number) {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
  }
}
