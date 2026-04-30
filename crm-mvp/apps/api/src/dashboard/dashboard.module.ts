import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { Client } from '../entities/client.entity';
import { Schedule } from '../entities/schedule.entity';
import { Contract } from '../entities/contract.entity';
import { Reminder } from '../entities/reminder.entity';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Client, Schedule, Contract, Reminder])],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
