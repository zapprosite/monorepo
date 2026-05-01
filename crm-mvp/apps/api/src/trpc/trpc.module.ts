import { Module } from '@nestjs/common';
import { TrpcRouter } from './trpc.router';
import { DashboardModule } from '../dashboard/dashboard.module';
import { LeadsModule } from '../leads/leads.module';
import { ClientsModule } from '../clients/clients.module';
import { SchedulesModule } from '../schedule/schedules.module';
import { ContractsModule } from '../contracts/contracts.module';
import { RemindersModule } from '../reminders/reminders.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [DashboardModule, LeadsModule, ClientsModule, SchedulesModule, ContractsModule, RemindersModule, UsersModule],
  providers: [TrpcRouter],
  exports: [TrpcRouter],
})
export class TrpcModule {}
