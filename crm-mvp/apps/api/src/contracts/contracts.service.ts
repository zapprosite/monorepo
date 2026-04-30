import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Contract } from '../entities/contract.entity';

@Injectable()
export class ContractsService {
  constructor(@InjectRepository(Contract) private repo: Repository<Contract>) {}

  findAll(filters?: { status?: string; type?: string; clientId?: string }) {
    const qb = this.repo.createQueryBuilder('contract')
      .leftJoinAndSelect('contract.client', 'client');

    if (filters?.status) qb.andWhere('contract.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('contract.type = :type', { type: filters.type });
    if (filters?.clientId) qb.andWhere('contract.clientId = :clientId', { clientId: filters.clientId });

    return qb.orderBy('contract.endDate', 'ASC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['client'] });
  }

  create(data: Partial<Contract>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Contract>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }

  async findExpiringSoon(days = 30) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return this.repo.find({
      where: {
        endDate: MoreThanOrEqual(date.toISOString().split('T')[0]),
        status: 'ativo',
      },
      relations: ['client'],
      order: { endDate: 'ASC' },
    });
  }
}
