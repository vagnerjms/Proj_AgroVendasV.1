import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtGuard, RolesGuard)
@Roles('broker', 'financial', 'accountant')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@Query('start') start?: string, @Query('end') end?: string) {
    return this.dashboardService.summary(start, end);
  }

  @Get('fiscal-summary')
  fiscalSummary(@Query('start') start?: string, @Query('end') end?: string) {
    return this.dashboardService.fiscalSummary(start, end);
  }

  @Get('loja-pdf-data')
  lojaPdfData(@Query('start') start?: string, @Query('end') end?: string) {
    return this.dashboardService.lojaPdfData(start, end);
  }
}
