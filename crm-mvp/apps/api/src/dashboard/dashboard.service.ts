import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { Client } from '../entities/client.entity';
import { Schedule } from '../entities/schedule.entity';
import { Contract } from '../entities/contract.entity';
import { Reminder } from '../entities/reminder.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Schedule) private scheduleRepo: Repository<Schedule>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
    @InjectRepository(Reminder) private reminderRepo: Repository<Reminder>,
  ) {}

  async getStats() {
    const [
      totalClients,
      activeLeads,
      activeContracts,
      pendingReminders,
      todaySchedules,
    ] = await Promise.all([
      this.clientRepo.count({ where: { status: 'ativo' } }),
      this.leadRepo.count({ where: { status: 'novo' } }),
      this.contractRepo.count({ where: { status: 'ativo' } }),
      this.reminderRepo.count({ where: { status: 'pendente' } }),
      this.scheduleRepo.count({
        where: {
          dateTime: new Date(),
          status: 'agendado',
        },
      }),
    ]);

    return {
      totalClients,
      activeLeads,
      activeContracts,
      pendingReminders,
      todaySchedules,
    };
  }

  async getRecentItems() {
    const [recentSchedules, recentReminders, recentContracts] = await Promise.all([
      this.scheduleRepo.find({
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['client'],
      }),
      this.reminderRepo.find({
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['client'],
      }),
      this.contractRepo.find({
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['client'],
      }),
    ]);

    return { recentSchedules, recentReminders, recentContracts };
  }
}
