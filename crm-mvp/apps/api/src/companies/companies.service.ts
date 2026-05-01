import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entities/company.entity';

@Injectable()
export class CompaniesService {
  constructor(@InjectRepository(Company) private repo: Repository<Company>) {}

  find() {
    return this.repo.findOne({ where: {} });
  }

  async upsert(data: Partial<Company>) {
    let company = await this.repo.findOne({ where: {} });
    if (!company) {
      company = this.repo.create(data);
    } else {
      Object.assign(company, data);
    }
    return this.repo.save(company);
  }
}
