import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfService } from './pdf.service';
import { Company } from '../entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
