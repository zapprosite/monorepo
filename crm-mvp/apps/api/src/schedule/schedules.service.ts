import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../entities/schedule.entity';

@Injectable()
export class SchedulesService {
  constructor(@InjectRepository(Schedule) private repo: Repository<Schedule>) {}

  findAll(filters?: { status?: string; type?: string; clientId?: string }) {
    const qb = this.repo.createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.client', 'client')
      .leftJoinAndSelect('schedule.technician', 'technician');

    if (filters?.status) qb.andWhere('schedule.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('schedule.type = :type', { type: filters.type });
    if (filters?.clientId) qb.andWhere('schedule.clientId = :clientId', { clientId: filters.clientId });

    return qb.orderBy('schedule.dateTime', 'ASC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['client', 'technician'],
    });
  }

  create(data: Partial<Schedule>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Schedule>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }
}
