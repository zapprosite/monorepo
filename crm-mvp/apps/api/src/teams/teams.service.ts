import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
  ) {}

  async findAll(): Promise<Team[]> {
    return this.teamRepo.find({
      relations: ['users'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id },
      relations: ['users'],
    });
    if (!team) throw new NotFoundException('Equipe não encontrada');
    return team;
  }

  async create(data: { name: string; description?: string }): Promise<Team> {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await this.teamRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Já existe uma equipe com este nome');

    const team = this.teamRepo.create({
      name: data.name,
      slug,
      description: data.description || null,
    });

    return this.teamRepo.save(team);
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<Team> {
    const team = await this.findOne(id);

    let slug = team.slug;
    if (data.name && data.name !== team.name) {
      slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const existing = await this.teamRepo.findOne({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictException('Já existe uma equipe com este nome');
    }

    if (data.name !== undefined) team.name = data.name;
    if (data.description !== undefined) team.description = data.description;
    team.slug = slug;

    return this.teamRepo.save(team);
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.teamRepo.remove(team);
  }
}
