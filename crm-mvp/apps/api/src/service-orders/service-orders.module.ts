import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceOrder } from '../entities/serviceOrder.entity';
import { Company } from '../entities/company.entity';
import { ServiceOrdersService } from './service-orders.service';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceOrder, Company]), PdfModule],
  providers: [ServiceOrdersService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
