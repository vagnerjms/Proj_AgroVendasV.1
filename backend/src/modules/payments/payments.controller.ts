import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SettlePaymentDto } from './dto/settle-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtGuard, RolesGuard)
@Roles('financial')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query()
    query: {
      type?: string;
      status?: string;
      orderNumber?: string;
      customerId?: string;
      producerId?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
    },
  ) {
    return this.paymentsService.findAll(query);
  }

  @Get('alerts')
  alerts() {
    return this.paymentsService.alerts();
  }

  @Get('summary')
  summary() {
    return this.paymentsService.summary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id/settle')
  settle(@Param('id') id: string, @Body() dto: SettlePaymentDto) {
    return this.paymentsService.settle(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.paymentsService.cancel(id, body.notes);
  }
}
