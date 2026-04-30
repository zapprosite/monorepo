import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(@InjectRepository(Client) private repo: Repository<Client>) {}

  findAll(filters?: { status?: string; type?: string; search?: string }) {
    const qb = this.repo.createQueryBuilder('client')
      .leftJoinAndSelect('client.leads', 'leads')
      .leftJoinAndSelect('client.contracts', 'contracts')
      .leftJoinAndSelect('client.schedules', 'schedules');

    if (filters?.status) qb.andWhere('client.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('client.type = :type', { type: filters.type });
    if (filters?.search) {
      qb.andWhere('(client.name ILIKE :search OR client.email ILIKE :search OR client.document ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    return qb.orderBy('client.createdAt', 'DESC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['leads', 'contracts', 'schedules', 'reminders'],
    });
  }

  create(data: Partial<Client>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Client>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }
}
