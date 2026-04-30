import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { Client } from '../entities/client.entity';
import { LeadsService } from './leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Client])],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
