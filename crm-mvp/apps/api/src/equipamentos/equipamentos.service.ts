import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipamento } from '../entities/equipamento.entity';

function generateSubdomain(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'eqp-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class EquipamentosService {
  constructor(@InjectRepository(Equipamento) private repo: Repository<Equipamento>) {}

  findAll(filters?: { status?: string; type?: string; clientId?: string; search?: string }) {
    const qb = this.repo.createQueryBuilder('equipamento');

    if (filters?.status) qb.andWhere('equipamento.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('equipamento.type = :type', { type: filters.type });
    if (filters?.clientId) qb.andWhere('equipamento.clientId = :clientId', { clientId: filters.clientId });
    if (filters?.search) {
      qb.andWhere(
        '(equipamento.name ILIKE :search OR equipamento.serialNumber ILIKE :search OR equipamento.subdomain ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return qb.orderBy('equipamento.createdAt', 'DESC').getMany();
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findBySubdomain(subdomain: string) {
    return this.repo.findOne({ where: { subdomain } });
  }

  async create(data: Partial<Equipamento>): Promise<Equipamento> {
    let subdomain = data.subdomain;
    if (!subdomain) {
      subdomain = generateSubdomain();
      let exists = await this.repo.findOne({ where: { subdomain } });
      let attempts = 0;
      while (exists && attempts < 10) {
        subdomain = generateSubdomain();
        exists = await this.repo.findOne({ where: { subdomain } });
        attempts++;
      }
      if (exists) {
        throw new Error('Could not generate unique subdomain');
      }
    }
    return this.repo.save(this.repo.create({ ...data, subdomain }));
  }

  async update(id: string, data: Partial<Equipamento>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { id, deleted: true };
  }
}
