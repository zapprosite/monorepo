import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../entities/contract.entity';
import { ContractsService } from './contracts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Contract])],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
