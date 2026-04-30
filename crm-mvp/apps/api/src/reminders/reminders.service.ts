import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from '../entities/reminder.entity';

@Injectable()
export class RemindersService {
  constructor(@InjectRepository(Reminder) private repo: Repository<Reminder>) {}

  findAll(filters?: { status?: string; type?: string; clientId?: string }) {
    const qb = this.repo.createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.client', 'client');

    if (filters?.status) qb.andWhere('reminder.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('reminder.type = :type', { type: filters.type });
    if (filters?.clientId) qb.andWhere('reminder.clientId = :clientId', { clientId: filters.clientId });

    return qb.orderBy('reminder.dueDate', 'ASC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['client'] });
  }

  create(data: Partial<Reminder>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Reminder>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }

  async complete(id: string) {
    await this.repo.update(id, { status: 'concluido' });
    return this.findOne(id);
  }
}
