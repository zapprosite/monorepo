import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { Client } from '../entities/client.entity';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
  ) {}

  findAll(filters?: { status?: string; source?: string; search?: string }) {
    const qb = this.repo.createQueryBuilder('lead')
      .leftJoinAndSelect('lead.responsible', 'responsible')
      .leftJoinAndSelect('lead.convertedToClient', 'client');

    if (filters?.status) qb.andWhere('lead.status = :status', { status: filters.status });
    if (filters?.source) qb.andWhere('lead.source = :source', { source: filters.source });
    if (filters?.search) {
      qb.andWhere('(lead.name ILIKE :search OR lead.email ILIKE :search OR lead.phone ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    return qb.orderBy('lead.createdAt', 'DESC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['responsible', 'convertedToClient'],
    });
  }

  create(data: Partial<Lead>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Lead>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }

  async convertToClient(id: string) {
    const lead = await this.findOne(id);
    if (!lead) throw new Error('Lead not found');
    if (lead.status === 'ganho') throw new Error('Lead already converted');

    const client = await this.clientRepo.save(this.clientRepo.create({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      type: 'pf',
      status: 'ativo',
      teamId: lead.teamId,
    }));

    await this.repo.update(id, {
      status: 'ganho',
      convertedToClientId: client.id,
    });

    return { leadId: id, clientId: client.id };
  }
}
