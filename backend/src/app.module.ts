import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FiscalDocumentsModule } from './modules/fiscal-documents/fiscal-documents.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProducersModule } from './modules/producers/producers.module';
import { ProductsModule } from './modules/products/products.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LotsModule } from './modules/lots/lots.module';

import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { SalesOrdersModule } from './modules/sales-orders/sales-orders.module';
import { UsersModule } from './modules/users/users.module';
import { BackupModule } from './modules/backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        mongoose.plugin((schema) => {
          if (!schema.path('isDeleted')) {
            return;
          }
          const methods = ['find', 'findOne', 'countDocuments', 'findOneAndUpdate'];
          methods.forEach((method) => {
            schema.pre(method as any, function () {
              const query = this as any;
              if (query.getFilter && query.getFilter().isDeleted === undefined) {
                query.where({ isDeleted: { $ne: true } });
              }
            });
          });
        });

        return {
          uri: config.get<string>('MONGODB_URI') ?? config.get<string>('MONGO_URI'),
        };
      },
    }),
    UsersModule,
    AuthModule,
    ProductsModule,
    ProducersModule,
    CustomersModule,
    LotsModule,
    PurchaseOrdersModule,
    SalesOrdersModule,
    PaymentsModule,
    FiscalDocumentsModule,
    DashboardModule,
    BackupModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
